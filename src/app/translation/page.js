"use client";
import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import Link from "next/link";
import {
	FaMicrophone,
	FaMicrophoneSlash,
	FaVideo,
	FaVideoSlash,
	FaPhone,
	FaCopy,
	FaVolumeUp,
	FaArrowLeft,
	FaBars,
	FaComments,
} from "react-icons/fa";

import { db } from "@/utils/firebaseConfig";
import { getAuth } from "firebase/auth";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import * as ort from "onnxruntime-web";
import { FilesetResolver, HandLandmarker, FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

const SOCKET_SERVER_URL = "https://backend-capstone-l19p.onrender.com";

export default function VideoCallPage() {
	const localVideoRef = useRef(null);
	const remoteVideoRef = useRef(null);
	const detectionCanvasRef = useRef(null);
	const pc = useRef(null);
	const socket = useRef(null);
	const iceQueue = useRef([]);
	const remoteIdRef = useRef(null);
	const handRef = useRef(null);
	const faceRef = useRef(null);
	const poseRef = useRef(null);
	const sessionRef = useRef(null);
	const meanRef = useRef(null);
	const stdRef = useRef(null);
	const labelsRef = useRef(null);

	const [remoteId, setRemoteId] = useState(null);
	const [isMuted, setIsMuted] = useState(false);
	const [cameraOn, setCameraOn] = useState(true);
	const [callActive, setCallActive] = useState(false);
	const [translations, setTranslations] = useState([]);
	const [currentWord, setCurrentWord] = useState("");
	const [manualMessage, setManualMessage] = useState("");

	const [localName, setLocalName] = useState("You");
	const [remoteName, setRemoteName] = useState("Remote");
	const [localType, setLocalType] = useState(""); // "DHH" or "HEARING"
	const [inviteCode, setInviteCode] = useState("");
	const [isRoomJoined, setIsRoomJoined] = useState(false);
	const [showLeft, setShowLeft] = useState(false);
	const [showRight, setShowRight] = useState(false);

	const flushIceQueueTo = (id) => {
		if (!socket.current || !id) return;
		iceQueue.current.forEach((candidate) => socket.current.emit("ice-candidate", { candidate, to: id }));
		iceQueue.current = [];
	};

	// ---- AI INITIALIZATION ----
	useEffect(() => {
		async function initAI() {
			const vision = await FilesetResolver.forVisionTasks(
				"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
			);
			handRef.current = await HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
				},
				runningMode: "VIDEO",
				numHands: 2,
			});
			faceRef.current = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
				},
				runningMode: "VIDEO",
				numFaces: 1,
			});
			poseRef.current = await PoseLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
				},
				runningMode: "VIDEO",
			});
			ort.env.wasm.wasmPaths = "/ort/";
			ort.env.wasm.numThreads = 1;
			sessionRef.current = await ort.InferenceSession.create("/model/sign_model.onnx", {
				executionProviders: ["wasm"],
			});
			meanRef.current = await fetch("/model/mean.json").then((r) => r.json());
			stdRef.current = await fetch("/model/std.json").then((r) => r.json());
			labelsRef.current = await fetch("/model/labels.json").then((r) => r.json());
			// [DEBUG] Mean length: meanRef.current?.length  (must be 158)
			// [DEBUG] Std length:  stdRef.current?.length   (must be 158)
			console.log("AI READY");
		}
		initAI();
	}, []);

	// ---- FEATURE EXTRACTOR (1:1 match with Python landmark_extractor) ----
	function buildFeatures(handRes, faceRes, poseRes) {
		const FEATURE_SIZE = 158;
		let leftHand = new Array(63).fill(0);
		let rightHand = new Array(63).fill(0);
		let leftGlobal = [0, 0, 0];
		let rightGlobal = [0, 0, 0];
		let leftDistances = new Array(5).fill(0);
		let rightDistances = new Array(5).fill(0);
		let leftEar = new Array(2).fill(0);
		let rightEar = new Array(2).fill(0);
		let poseUpper = new Array(12).fill(0);
		let facePoints = null;
		let faceScale = 1;

		// FACE
		if (faceRes.faceLandmarks && faceRes.faceLandmarks.length > 0) {
			const lm = faceRes.faceLandmarks[0];
			const idxs = {
				nose: 1,
				chin: 152,
				forehead: 10,
				left_cheek: 234,
				right_cheek: 454,
				left_ear: 127,
				right_ear: 356,
			};
			facePoints = {};
			Object.entries(idxs).forEach(([key, index]) => {
				const p = lm[index];
				facePoints[key] = [p.x, p.y, p.z];
			});
			const chin = facePoints["chin"];
			const forehead = facePoints["forehead"];
			faceScale =
				Math.sqrt((chin[0] - forehead[0]) ** 2 + (chin[1] - forehead[1]) ** 2 + (chin[2] - forehead[2]) ** 2) +
				1e-6;
		}

		// HANDS
		if (handRes.landmarks && handRes.landmarks.length > 0) {
			handRes.landmarks.forEach((landmarks, idx) => {
				// Tasks API uses person-perspective handedness; training used camera-perspective.
				// They are opposite, so we invert the assignment (not the label).
				const handedness = handRes.handedness[idx][0].categoryName;
				const arr = landmarks.map((l) => [l.x, l.y, l.z]);
				const wrist = arr[0];
				const centered = arr.map((p) => [p[0] - wrist[0], p[1] - wrist[1], p[2] - wrist[2]]);
				const scale = Math.sqrt(centered[9][0] ** 2 + centered[9][1] ** 2 + centered[9][2] ** 2) + 1e-6;
				const normalized = centered.map((p) => [p[0] / scale, p[1] / scale, p[2] / scale]);
				const flat = normalized.flat();
				const globalCenter = [
					arr.reduce((a, b) => a + b[0], 0) / 21,
					arr.reduce((a, b) => a + b[1], 0) / 21,
					arr.reduce((a, b) => a + b[2], 0) / 21,
				];
				const thumb = arr[4];
				let faceDist = new Array(5).fill(0);
				let earDist = new Array(2).fill(0);
				if (facePoints) {
					const keysFace = ["nose", "chin", "forehead", "left_cheek", "right_cheek"];
					keysFace.forEach((k, i) => {
						const fp = facePoints[k];
						const d = Math.sqrt(
							(thumb[0] - fp[0]) ** 2 + (thumb[1] - fp[1]) ** 2 + (thumb[2] - fp[2]) ** 2,
						);
						faceDist[i] = d / faceScale;
					});
					const keysEar = ["left_ear", "right_ear"];
					keysEar.forEach((k, i) => {
						const fp = facePoints[k];
						const d = Math.sqrt(
							(thumb[0] - fp[0]) ** 2 + (thumb[1] - fp[1]) ** 2 + (thumb[2] - fp[2]) ** 2,
						);
						earDist[i] = d / faceScale;
					});
				}
				// Inverted assignment: Tasks API "Left" → training "Right" and vice versa
				if (handedness === "Left") {
					rightHand = flat;
					rightGlobal = globalCenter;
					rightDistances = faceDist;
					rightEar = earDist;
				} else {
					leftHand = flat;
					leftGlobal = globalCenter;
					leftDistances = faceDist;
					leftEar = earDist;
				}
			});
		}

		// POSE
		if (poseRes.landmarks && poseRes.landmarks.length > 0) {
			const lm = poseRes.landmarks[0];
			const leftShoulder = lm[11];
			const rightShoulder = lm[12];
			const center = [
				(leftShoulder.x + rightShoulder.x) / 2,
				(leftShoulder.y + rightShoulder.y) / 2,
				(leftShoulder.z + rightShoulder.z) / 2,
			];
			const scale =
				Math.sqrt(
					(leftShoulder.x - rightShoulder.x) ** 2 +
						(leftShoulder.y - rightShoulder.y) ** 2 +
						(leftShoulder.z - rightShoulder.z) ** 2,
				) + 1e-6;
			const selected = [11, 12, 13, 14];
			poseUpper = selected.flatMap((i) => {
				const p = lm[i];
				return [(p.x - center[0]) / scale, (p.y - center[1]) / scale, (p.z - center[2]) / scale];
			});
		}

		const features = [
			...leftHand,
			...rightHand,
			...leftGlobal,
			...rightGlobal,
			...leftDistances,
			...rightDistances,
			...leftEar,
			...rightEar,
			...poseUpper,
		];
		if (features.length !== FEATURE_SIZE) return null;
		return features;
	}

	const initializeCall = async (userUID, userName, userType) => {
		socket.current = io(SOCKET_SERVER_URL, {
			transports: ["websocket"],
			timeout: 60000,
			reconnectionAttempts: 10,
			reconnectionDelay: 3000,
			reconnectionDelayMax: 15000,
		});

		let isCaller = false; // 🔹 prevents double-offer race

		socket.current.on("connect", () => {
			console.log("✅ Connected:", socket.current.id);
			console.log("📤 Registering user:", {
				room: inviteCode.trim(),
				uid: userUID,
				name: userName,
				userType,
			});

			socket.current.emit("register-user", {
				room: inviteCode.trim(),
				uid: userUID,
				name: userName,
				userType,
			});
		});

		socket.current.on("connect_error", (err) => console.warn("⚠️ Socket error:", err));

		socket.current.on("user-info", async ({ uid, name, userType, socketId }) => {
			console.log("🟣 Remote user info:", uid, name, userType, socketId);
			setRemoteName(`${name} (${userType || "User"})`);
			remoteIdRef.current = socketId;
			setRemoteId(socketId);
		});

		socket.current.on("new-translation", (data) => {
			setTranslations((prev) => [...prev, data]);
		});

		// 🧩 Handle remote user disconnect
		socket.current.on("user-left", () => {
			console.log("👋 Remote user disconnected");
			if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
			setRemoteId(null);
			setRemoteName("Remote");
		});

		// 🧩 Reconnection debugging logs
		socket.current.on("reconnect_attempt", (n) => console.log(`🔄 Reconnect attempt ${n}`));
		socket.current.on("reconnect", () => console.log("✅ Reconnected to signaling server"));
		socket.current.on("reconnect_failed", () => console.error("❌ Reconnect failed"));

		// ✅ TURN/STUN
		pc.current = new RTCPeerConnection({
			iceServers: [
				{ urls: "stun:stun.l.google.com:19302" },
				{ urls: "stun:stun.relay.metered.ca:80" },
				{
					urls: "turn:global.relay.metered.ca:80",
					username: "99a9e39930369645c93f8879",
					credential: "ebKW3RKGJ+RRKqBe",
				},
				{
					urls: "turn:global.relay.metered.ca:443",
					username: "99a9e39930369645c93f8879",
					credential: "ebKW3RKGJ+RRKqBe",
				},
				{
					urls: "turns:global.relay.metered.ca:443?transport=tcp",
					username: "99a9e39930369645c93f8879",
					credential: "ebKW3RKGJ+RRKqBe",
				},
			],
		});

		const getPc = () => pc.current;

		// 🧠 Connection state logs
		pc.current.onconnectionstatechange = () => {
			console.log("🔌 Connection state:", pc.current.connectionState);
			switch (pc.current.connectionState) {
				case "connected":
					console.log("🟢 Peers connected! ✅ Media should flow.");
					break;
				case "failed":
					console.error("❌ Connection failed! (Check TURN/STUN config)");
					break;
				case "disconnected":
					console.warn("🔴 Connection temporarily lost.");
					break;
			}
		};

		pc.current.oniceconnectionstatechange = () => {
			console.log("🧊 ICE connection state:", pc.current.iceConnectionState);
		};

		pc.current.ontrack = (event) => {
			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = event.streams[0];
				remoteVideoRef.current.play().catch(() => console.warn("Autoplay blocked"));
			}
		};

		pc.current.onicecandidate = (event) => {
			if (event?.candidate) {
				const target = remoteIdRef.current;
				if (target && socket.current) {
					socket.current.emit("ice-candidate", { candidate: event.candidate, to: target });
				} else {
					iceQueue.current.push(event.candidate);
				}
			}
		};

		// 🟢 When a new user joins the same room, send offer only once
		socket.current.on("new-user", async (newUserSocketId) => {
			if (isCaller) return; // prevent duplicate offers
			isCaller = true;

			console.log("👋 New peer joined the room:", newUserSocketId);
			const _pc = getPc();
			if (!_pc) return;

			try {
				const offer = await _pc.createOffer();
				await _pc.setLocalDescription(offer);
				socket.current.emit("offer", { sdp: offer, to: newUserSocketId });
				console.log("📡 Sent SDP offer to:", newUserSocketId);
			} catch (err) {
				console.error("⚠️ Error creating offer:", err);
			}
		});

		// 🔄 Handle incoming offer → respond with answer
		socket.current.on("offer", async (data) => {
			isCaller = false; // this peer will answer only
			const fromId = data.from || data.sender || data.fromId;
			if (!fromId) return;
			remoteIdRef.current = fromId;
			setRemoteId(fromId);

			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

				// Send answer back
				const answer = await _pc.createAnswer();
				await _pc.setLocalDescription(answer);
				socket.current.emit("answer", { sdp: answer, to: fromId });
				flushIceQueueTo(fromId);
				console.log("📡 Sent SDP answer to:", fromId);
			} catch (err) {
				console.error("⚠️ Error handling offer:", err);
			}
		});

		// 🔄 Handle answer from remote peer
		socket.current.on("answer", async (data) => {
			const fromId = data.from || data.sender || data.fromId;
			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
				flushIceQueueTo(fromId || remoteIdRef.current);
				console.log("✅ Remote description set from answer");
			} catch (err) {
				console.error("⚠️ Error handling answer:", err);
			}
		});

		// 🧊 Handle ICE candidates from remote peer
		socket.current.on("ice-candidate", async ({ candidate }) => {
			if (!candidate) return;
			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (err) {
				console.error("⚠️ Error adding ICE candidate:", err);
			}
		});

		// 🔹 Join Room
		if (inviteCode.trim()) {
			socket.current.emit("join-room", inviteCode.trim());
			setIsRoomJoined(true);
			console.log("🟢 Joined room:", inviteCode);
		} else {
			alert("Please enter an invite code first!");
		}
	};

	const startVideo = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { width: { ideal: 640 }, height: { ideal: 480 } },
				audio: true,
			});
			if (localVideoRef.current) localVideoRef.current.srcObject = stream;
			const _pc = pc.current;
			if (!_pc) return;
			stream.getTracks().forEach((track) => _pc.addTrack(track, stream));
		} catch (err) {
			console.error(err);
			alert("Please allow camera/microphone.");
		}
	};

	const handleCallToggle = async () => {
		const auth = getAuth();
		const user = auth.currentUser;

		if (!user) {
			alert("You must be logged in to start a call.");
			return;
		}

		if (!callActive) {
			if (!inviteCode.trim()) {
				alert("Enter or generate an invite code first!");
				return;
			}

			const localRef = doc(db, "users", user.uid);
			const localSnap = await getDoc(localRef);
			let userName = "You";
			let userType = "HEARING";

			if (localSnap.exists()) {
				const data = localSnap.data();
				userName = data.name || "You";
				userType = data.userType ? data.userType.toUpperCase() : "HEARING";
				setLocalName(userName);
				setLocalType(userType);
				console.log(`✅ Local User: ${userName} (${userType})`);
			}

			await initializeCall(user.uid, userName, userType);
			await startVideo();
			setCallActive(true);
		} else {
			localVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
			remoteVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());

			// 🧹 Clear remote video feed visually
			if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

			pc.current?.close();
			socket.current?.disconnect();
			setCallActive(false);
			setIsRoomJoined(false);

			setTranslations([]); // 🧹 clear translation history
			window.dispatchEvent(new Event("clear-translation")); // 🧹 reset internal vars too
		}
	};

	const toggleMute = () => {
		const newMuted = !isMuted;
		localVideoRef.current?.srcObject?.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
		setIsMuted(newMuted);
	};

	const toggleCamera = () => {
		const newCam = !cameraOn;
		localVideoRef.current?.srcObject?.getVideoTracks().forEach((t) => (t.enabled = newCam));
		setCameraOn(newCam);
	};

	const copyText = (text) => navigator.clipboard.writeText(text);
	const speakText = (text) => {
		speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = "en-US";
		speechSynthesis.speak(u);
	};

	useEffect(() => {
		if (!callActive || localType !== "DHH") return;
		if (!sessionRef.current) return;

		let animationId;
		let isProcessing = false;
		let lastPredictionTime = 0;
		const PREDICTION_INTERVAL = 50;
		const sentenceRef = { current: "" };

		// Sliding window majority voting — mirrors Python deque(maxlen=15) + Counter logic
		const WINDOW_SIZE = 15;
		const REQUIRED_COUNT = 8;
		const COOLDOWN_FRAMES = 20;
		const predictionBuffer = [];
		let cooldown = 0;
		let lastOutput = "";

		const clearListener = () => {
			sentenceRef.current = "";
			predictionBuffer.length = 0;
			cooldown = 0;
			lastOutput = "";
			setCurrentWord("");
		};
		window.addEventListener("clear-translation", clearListener);

		async function loop() {
			const video = localVideoRef.current;
			if (!video) {
				animationId = requestAnimationFrame(loop);
				return;
			}

			if (!handRef.current || !faceRef.current || !poseRef.current) {
				animationId = requestAnimationFrame(loop);
				return;
			}

			if (!meanRef.current || !stdRef.current || !labelsRef.current) {
				animationId = requestAnimationFrame(loop);
				return;
			}

			const nowTime = Date.now();
			if (nowTime - lastPredictionTime < PREDICTION_INTERVAL) {
				animationId = requestAnimationFrame(loop);
				return;
			}
			lastPredictionTime = nowTime;

			if (isProcessing) {
				animationId = requestAnimationFrame(loop);
				return;
			}
			isProcessing = true;

			// Draw to 640×480 canvas to match Python training resolution
			if (!detectionCanvasRef.current) {
				detectionCanvasRef.current = document.createElement("canvas");
			}
			const canvas = detectionCanvasRef.current;
			canvas.width = 640;
			canvas.height = 480;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(video, 0, 0, 640, 480);

			const now = performance.now();

			const handRes = handRef.current.detectForVideo(canvas, now);
			const faceRes = faceRef.current.detectForVideo(canvas, now);
			const poseRes = poseRef.current.detectForVideo(canvas, now);

			// Gate: no hands → clear buffer to avoid idle frames polluting the window
			if (!handRes.landmarks || handRes.landmarks.length === 0) {
				predictionBuffer.length = 0;
				isProcessing = false;
				animationId = requestAnimationFrame(loop);
				return;
			}

			const features = buildFeatures(handRes, faceRes, poseRes);
			if (!features) {
				isProcessing = false;
				animationId = requestAnimationFrame(loop);
				return;
			}

			const normalized = features.map((v, i) => (v - meanRef.current[i]) / stdRef.current[i]);

			const tensor = new ort.Tensor("float32", normalized, [1, 158]);
			const output = await sessionRef.current.run({ input: tensor });
			const logits = output.logits.data;

			const maxLogit = Math.max(...logits);
			const exps = logits.map((v) => Math.exp(v - maxLogit));
			const sum = exps.reduce((a, b) => a + b, 0);
			const probs = exps.map((v) => v / sum);

			const bestIndex = probs.indexOf(Math.max(...probs));
			const label = labelsRef.current[String(bestIndex)];
			const confidence = probs[bestIndex];

			// Debug (re-enable if needed): handedness, features, confidence
			// console.log("[DEBUG] Handedness:", handRes.handedness?.map((h) => h[0]?.categoryName));
			// console.log("[DEBUG] Feature length:", features?.length, "First 10:", features?.slice(0, 10));
			// console.log("[DEBUG] Prediction:", label, "| Confidence:", confidence.toFixed(4));

			// Push into sliding window buffer (only confident predictions)
			if (confidence >= 0.6) {
				predictionBuffer.push(label);
				if (predictionBuffer.length > WINDOW_SIZE) predictionBuffer.shift();
			}

			// Majority vote — mirrors Python Counter logic
			let stableLabel = null;
			if (predictionBuffer.length === WINDOW_SIZE) {
				const counts = {};
				predictionBuffer.forEach((l) => {
					counts[l] = (counts[l] || 0) + 1;
				});
				const [[topLabel, topCount]] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
				if (topCount >= REQUIRED_COUNT) stableLabel = topLabel;
			}

			// Cooldown — mirrors Python cooldown_timer logic
			if (cooldown > 0) {
				cooldown--;
			} else if (stableLabel && stableLabel !== lastOutput) {
				lastOutput = stableLabel;
				sentenceRef.current = sentenceRef.current ? `${sentenceRef.current} ${stableLabel}` : stableLabel;
				setCurrentWord(sentenceRef.current);
				cooldown = COOLDOWN_FRAMES;
			}

			isProcessing = false;
			animationId = requestAnimationFrame(loop);
		}

		loop();

		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener("clear-translation", clearListener);
		};
	}, [callActive, localType]);

	const sendTranslation = async () => {
		if (localType !== "DHH") return alert("Hearing users cannot use gesture translation.");
		if (!currentWord.trim() || !socket.current) return;

		const timestamp = new Date().toISOString();
		const obj = {
			sender: localName,
			text: currentWord.trim(),
			timestamp,
		};

		setTranslations((p) => [...p, obj]);
		socket.current.emit("new-translation", obj);

		await addDoc(collection(db, "translations"), {
			room: inviteCode,
			sender: localName,
			text: currentWord.trim(),
			timestamp: serverTimestamp(),
		});

		// 🔥 Reset properly
		setCurrentWord("");
		window.dispatchEvent(new Event("clear-translation"));
	};

	const sendChatMessage = async () => {
		if (localType === "DHH") return alert("DHH users cannot send typed messages.");
		if (!manualMessage.trim() || !socket.current) return;
		const timestamp = new Date().toISOString();
		const obj = { sender: localName, text: manualMessage, timestamp };

		setTranslations((p) => [...p, obj]);
		socket.current.emit("new-translation", obj);
		setManualMessage("");
		await addDoc(collection(db, "translations"), {
			room: inviteCode,
			sender: localName,
			text: manualMessage,
			timestamp: serverTimestamp(),
		});
	};

	useEffect(() => {
		return () => {
			pc.current?.close();
			socket.current?.disconnect();
		};
	}, []);

	// --- UI (UNCHANGED) ---
	return (
		<div className="flex h-screen bg-gray-100 text-gray-900 relative">
			{/* MOBILE MENU BUTTONS */}
			<div className="md:hidden fixed top-4 left-4 z-50">
				<button
					onClick={() => setShowLeft(!showLeft)}
					className="p-3 bg-gray-900 text-white rounded-full shadow-lg active:scale-90 transition"
				>
					<FaBars size={20} />
				</button>
			</div>

			<div className="md:hidden fixed top-4 right-4 z-50">
				<button
					onClick={() => setShowRight(!showRight)}
					className="p-3 bg-gray-900 text-white rounded-full shadow-lg active:scale-90 transition"
				>
					<FaComments size={20} />
				</button>
			</div>

			{/* Left Sidebar */}
			<div
				className={`
        fixed top-0 left-0 h-full w-72 bg-white/95 shadow-xl p-6 border-r border-gray-200
        flex flex-col justify-between transform transition-transform duration-300 z-40
        ${showLeft ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:w-80
    `}
			>
				<div>
					<Link href="/userdashboard">
						<div className="p-3 mb-8 bg-gray-800 text-white rounded-full shadow-md hover:bg-gray-900 transition w-fit mx-auto">
							<FaArrowLeft className="text-lg" />
						</div>
					</Link>

					{/* Invite Code */}
					<div className="flex flex-col items-center gap-4 mb-6">
						<h3 className="text-lg font-semibold text-gray-800 tracking-wide">Invite Code</h3>
						<div className="flex gap-2">
							<input
								type="text"
								value={inviteCode}
								onChange={(e) => setInviteCode(e.target.value)}
								placeholder="Enter or share code"
								className="border border-gray-300 rounded-lg px-3 py-2 w-44 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
							/>
							<button
								onClick={() => setInviteCode(Math.random().toString(36).substring(2, 8).toUpperCase())}
								className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm shadow hover:bg-blue-600"
							>
								Gen
							</button>
						</div>
						{inviteCode && (
							<button
								onClick={() => navigator.clipboard.writeText(inviteCode)}
								className="text-xs mt-1 px-2 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition"
							>
								Copy Code
							</button>
						)}
					</div>
					<div className="text-center mb-4">
						{isRoomJoined ? (
							<p className="text-green-600 text-sm font-medium flex items-center justify-center gap-2">
								<span className="text-lg">🟢</span> Joined Room
							</p>
						) : (
							<p className="text-gray-500 text-sm italic">Enter a room to start</p>
						)}
					</div>
				</div>
			</div>

			{/* Main */}
			<main
				className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 gap-6 
    md:ml-80 md:mr-80 overflow-auto"
			>
				{/* Videos */}
				<div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl items-center justify-center">
					{/* Local */}
					<div className="relative w-full md:w-1/2 max-w-md">
						<video
							ref={localVideoRef}
							autoPlay
							muted
							playsInline
							className="w-full aspect-video bg-black rounded-xl shadow-lg object-cover"
						/>
						<div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2 text-sm">
							{/* ✅ Firebase name instead of static “You” */}
							<span>{localName}</span>
							{isMuted ? (
								<FaMicrophoneSlash className="text-red-500" />
							) : (
								<FaMicrophone className="text-green-500" />
							)}
							{cameraOn ? (
								<FaVideo className="text-green-500" />
							) : (
								<FaVideoSlash className="text-red-500" />
							)}
						</div>
					</div>

					{/* Remote */}
					<div className="relative w-full md:w-1/2 max-w-md">
						<video
							ref={remoteVideoRef}
							autoPlay
							playsInline
							className="w-full aspect-video bg-black rounded-xl shadow-lg object-cover"
						/>
						<div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2 text-sm">
							{/* ✅ Firebase name instead of static “Remote” */}
							<span>{remoteName}</span>
							<FaMicrophone className="text-green-500" />
							<FaVideo className="text-green-500" />
						</div>
					</div>
				</div>

				{/* Controls */}
				<div className="flex flex-wrap justify-center gap-4 md:gap-6 bg-gray-100 p-3 rounded-xl shadow-inner mt-4">
					<button
						onClick={toggleMute}
						className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-white ${
							isMuted ? "bg-gray-500" : "bg-green-500"
						}`}
					>
						{isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}{" "}
						<span className="hidden md:inline">{isMuted ? "Unmute" : "Mute"}</span>
					</button>
					<button
						onClick={toggleCamera}
						className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-white ${
							cameraOn ? "bg-blue-500" : "bg-gray-500"
						}`}
					>
						{cameraOn ? <FaVideo /> : <FaVideoSlash />}{" "}
						<span className="hidden md:inline">{cameraOn ? "Camera On" : "Camera Off"}</span>
					</button>
					<button
						onClick={handleCallToggle}
						className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-white ${
							callActive ? "bg-red-500" : "bg-green-500"
						}`}
					>
						<FaPhone /> <span className="hidden md:inline">{callActive ? "End Call" : "Start Call"}</span>
					</button>
				</div>

				{/* Live Translation */}
				<div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-5 flex flex-col mt-4">
					<div className="flex justify-between items-center mb-3">
						<h3 className="text-lg font-semibold text-gray-800">Live Translation</h3>
						<div className="flex gap-2">
							<button
								onClick={async () => {
									await sendTranslation();
									window.dispatchEvent(new Event("clear-translation")); // 🧹 reset internal vars too
								}}
								className={`px-3 py-1 text-xs rounded-full text-white ${
									localType === "DHH"
										? "bg-green-500 hover:bg-green-600"
										: "bg-gray-400 cursor-not-allowed"
								}`}
								disabled={localType !== "DHH"}
							>
								Enter
							</button>

							<button
								onClick={() => {
									setCurrentWord("");
									window.dispatchEvent(new Event("clear-translation"));
								}}
								className="px-3 py-1 text-xs bg-red-500 text-white rounded-full"
							>
								Clear
							</button>
						</div>
					</div>

					<div className="h-36 bg-gray-50 p-4 rounded-xl border border-gray-200 overflow-y-auto flex items-start">
						{currentWord ? (
							<p className="text-gray-800">{currentWord}</p>
						) : (
							<p className="text-gray-400 italic">Ongoing translation appears here...</p>
						)}
					</div>

					{/* Chat input */}
					<div className="flex items-center gap-3 mt-4">
						<input
							type="text"
							value={manualMessage}
							onChange={(e) => setManualMessage(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
							placeholder="Type a message..."
							className={`flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
								localType === "DHH" ? "bg-gray-200 cursor-not-allowed" : ""
							}`}
							disabled={localType === "DHH"}
						/>
						<button
							onClick={sendChatMessage}
							className={`px-4 py-2 text-white rounded-full text-sm shadow ${
								localType === "DHH" ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
							}`}
							disabled={localType === "DHH"}
						>
							Send
						</button>
					</div>
				</div>
			</main>

			<aside
				className={`
        fixed top-0 right-0 h-full w-72 bg-white/95 shadow-xl p-6 overflow-y-auto border-l border-gray-200
        transform transition-transform duration-300 z-40 flex flex-col
        ${showRight ? "translate-x-0" : "translate-x-full"}
        md:translate-x-0 md:w-80
    `}
			>
				<h2 className="text-2xl font-bold mb-6 text-gray-900">Translation History</h2>
				<div className="flex flex-col gap-4">
					{translations.map((item, i) => {
						const align =
							item.sender === localName
								? "self-end bg-blue-100 text-right"
								: "self-start bg-green-100 text-left";
						return (
							<div key={i} className={`p-4 rounded-2xl shadow-sm max-w-[85%] ${align}`}>
								{/* ✅ sender name shown above the message */}
								<p className="text-xs text-gray-600 mb-1 font-semibold">{item.sender}</p>
								<p className="font-medium text-gray-800">{item.text}</p>
								<div className="flex justify-between items-center mt-2 text-xs text-gray-500">
									<div className="flex justify-between items-center mt-2 text-xs text-gray-500">
										<span>
											{item.timestamp && !isNaN(Date.parse(item.timestamp))
												? new Date(item.timestamp).toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
														hour12: true, // 👈 ensures 12-hour format with AM/PM
													})
												: "Pending"}
										</span>
									</div>
								</div>
								<div className="flex gap-2 mt-3 justify-end">
									<button
										onClick={() => copyText(item.text)}
										className="p-2 bg-blue-500 text-white rounded-full"
									>
										<FaCopy />
									</button>
									<button
										onClick={() => speakText(item.text)}
										className="p-2 bg-gray-700 text-white rounded-full"
									>
										<FaVolumeUp />
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</aside>
		</div>
	);
}
