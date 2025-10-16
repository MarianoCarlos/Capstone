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
} from "react-icons/fa";

import { db } from "@/utils/firebaseConfig";
import { getAuth } from "firebase/auth";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const SOCKET_SERVER_URL = "https://backend-capstone-l19p.onrender.com";
const ASL_BACKEND_URL = "https://my-model-server.onrender.com/predict";

export default function VideoCallPage() {
	const localVideoRef = useRef(null);
	const remoteVideoRef = useRef(null);
	const pc = useRef(null);
	const socket = useRef(null);
	const iceQueue = useRef([]);
	const remoteIdRef = useRef(null);

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

	const flushIceQueueTo = (id) => {
		if (!socket.current || !id) return;
		iceQueue.current.forEach((candidate) => socket.current.emit("ice-candidate", { candidate, to: id }));
		iceQueue.current = [];
	};

	const initializeCall = async (userUID, userName, userType) => {
		socket.current = io(SOCKET_SERVER_URL, {
			transports: ["websocket"], // ✅ force WebSocket transport
			timeout: 20000,
			reconnectionAttempts: 5,
			reconnectionDelay: 2000,
			reconnectionDelayMax: 8000,
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
			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

		let handLandmarker;
		let isRunning = true;

		const sentenceRef = { current: "" }; // holds continuous sentence
		const clearListener = () => {
			sentenceRef.current = "";
			setCurrentWord("");
			console.log("🧹 Cleared translation buffer.");
		};
		window.addEventListener("clear-translation", clearListener);
		let lastLabel = "";
		let stableCount = 0;
		let lastAppendTime = 0;

		async function initMediaPipe() {
			const vision = await FilesetResolver.forVisionTasks(
				"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
			);

			handLandmarker = await HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
				},
				runningMode: "VIDEO",
				numHands: 2,
			});

			console.log("🖐️ MediaPipe Hands initialized");
			startDetectionLoop();
		}

		async function startDetectionLoop() {
			let lastVideoTime = -1;

			async function loop() {
				if (!isRunning || !localVideoRef.current) return requestAnimationFrame(loop);
				const video = localVideoRef.current;

				if (video.currentTime === lastVideoTime) return requestAnimationFrame(loop);
				lastVideoTime = video.currentTime;

				try {
					const results = await handLandmarker.detectForVideo(video, performance.now());

					if (results.landmarks && results.landmarks.length > 0) {
						const hands = results.landmarks.map((lm, i) => {
							const handed = results.handedness?.[i]?.[0]?.categoryName || "Unknown";
							return {
								handedness: handed,
								points: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
							};
						});

						const res = await fetch(ASL_BACKEND_URL, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ hands }),
						});
						const data = await res.json();

						if (data.label) {
							const label = data.label.trim();
							if (!label) return;

							// Always show what model currently sees
							setCurrentWord((prev) => {
								const preview = sentenceRef.current ? `${sentenceRef.current} ${label}`.trim() : label;
								return preview;
							});

							// Check if this label is stable (avoid flicker)
							if (label === lastLabel) {
								stableCount++;
							} else {
								stableCount = 1;
								lastLabel = label;
							}

							// After stable detection for several frames, append it once
							if (stableCount > 10 && Date.now() - lastAppendTime > 800) {
								const words = sentenceRef.current.trim().split(" ");
								const lastWord = words[words.length - 1];
								if (lastWord?.toLowerCase() !== label.toLowerCase()) {
									sentenceRef.current = (sentenceRef.current + " " + label).trim();
								}
								setCurrentWord(sentenceRef.current); // update UI
								lastAppendTime = Date.now();
								stableCount = 0;
							}
						}
					}
				} catch (err) {
					console.error("Prediction error:", err);
				}

				requestAnimationFrame(loop);
			}

			loop();
		}

		initMediaPipe();

		return () => {
			isRunning = false;
			window.removeEventListener("clear-translation", clearListener);
		};
	}, [callActive, localType]);

	const sendTranslation = async () => {
		if (localType !== "DHH") return alert("Hearing users cannot use gesture translation.");
		if (!currentWord.trim() || !socket.current) return;

		const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		const obj = { sender: localName, text: currentWord.trim(), timestamp };

		setTranslations((p) => [...p, obj]);
		socket.current.emit("new-translation", obj);

		await addDoc(collection(db, "translations"), {
			room: inviteCode,
			sender: localName,
			text: currentWord.trim(),
			timestamp: new Date().toISOString(),
		});

		// Reset buffer after sending full phrase
		setCurrentWord("");
	};

	const sendChatMessage = async () => {
		if (localType === "DHH") return alert("DHH users cannot send typed messages.");
		if (!manualMessage.trim() || !socket.current) return;
		const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		const obj = { sender: localName, text: manualMessage, timestamp };
		setTranslations((p) => [...p, obj]);
		socket.current.emit("new-translation", obj);
		setManualMessage("");
		await addDoc(collection(db, "translations"), {
			room: inviteCode,
			sender: localName,
			text: manualMessage,
			timestamp: new Date().toISOString(),
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
			{/* Left Sidebar */}
			<div className="fixed top-0 left-0 h-full w-80 bg-white/95 shadow-xl p-6 border-r border-gray-200 flex flex-col justify-between">
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
			<main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 ml-80 mr-80">
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

			<aside className="fixed top-0 right-0 h-full w-80 bg-white/95 shadow-xl p-6 overflow-y-auto border-l border-gray-200 flex flex-col">
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
									<span>{item.timestamp}</span>
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
