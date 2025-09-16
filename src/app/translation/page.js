"use client";
import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhone } from "react-icons/fa";

const SOCKET_SERVER_URL = "https://backend-capstone-l19p.onrender.com"; // Replace with your deployed signaling server

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
	const [liveTranslation, setLiveTranslation] = useState("");
	const [translations, setTranslations] = useState([
		{
			sender: "local",
			textEn: "Hello, how are you?",
			textFil: "Kamusta, kumusta ka?",
			accuracy: "98%",
			timestamp: "10:32 AM",
			showLang: "En",
		},
		{
			sender: "remote",
			textEn: "I am fine, thank you!",
			textFil: "Ayos lang ako, salamat!",
			accuracy: "97%",
			timestamp: "10:33 AM",
			showLang: "En",
		},
	]);

	// negotiation state helpers
	const makingOffer = useRef(false);
	const ignoreOffer = useRef(false);
	const isPolite = useRef(false); // polite/impolite role

	// helper: flush queued ICE to a given id
	const flushIceQueueTo = (id) => {
		if (!socket.current || !id) return;
		iceQueue.current.forEach((candidate) => socket.current.emit("ice-candidate", { candidate, to: id }));
		iceQueue.current = [];
	};

	useEffect(() => {
		// Connect socket
		socket.current = io(SOCKET_SERVER_URL);

		socket.current.on("connect", () => {
			console.log("✅ Connected to signaling server:", socket.current.id);
		});
		socket.current.on("connect_error", (err) => {
			console.warn("Socket connect error:", err);
		});

		// Create PeerConnection
		pc.current = new RTCPeerConnection({
			iceServers: [
				{ urls: "stun:stun.relay.metered.ca:80" },
				{
					urls: "turn:global.relay.metered.ca:80",
					username: "d32a9a3a2410a9814d92f496",
					credential: "1pHpTSjADEGTm86/",
				},
				{
					urls: "turn:global.relay.metered.ca:80?transport=tcp",
					username: "d32a9a3a2410a9814d92f496",
					credential: "1pHpTSjADEGTm86/",
				},
				{
					urls: "turn:global.relay.metered.ca:443",
					username: "d32a9a3a2410a9814d92f496",
					credential: "1pHpTSjADEGTm86/",
				},
				{
					urls: "turns:global.relay.metered.ca:443?transport=tcp",
					username: "d32a9a3a2410a9814d92f496",
					credential: "1pHpTSjADEGTm86/",
				},
				// ✅ OpenRelay fallback
				{
					urls: "turn:openrelay.metered.ca:80",
					username: "openrelayproject",
					credential: "openrelayproject",
				},
				{
					urls: "turn:openrelay.metered.ca:443",
					username: "openrelayproject",
					credential: "openrelayproject",
				},
				{
					urls: "turn:openrelay.metered.ca:443?transport=tcp",
					username: "openrelayproject",
					credential: "openrelayproject",
				},
			],
		});

		const getPc = () => pc.current;

		// negotiationneeded
		pc.current.onnegotiationneeded = async () => {
			try {
				makingOffer.current = true;
				const _pc = getPc();
				const offer = await _pc.createOffer();
				await _pc.setLocalDescription(offer);
				socket.current.emit("offer", { sdp: _pc.localDescription, to: remoteIdRef.current });
				console.log("🔀 Sent offer to", remoteIdRef.current);
			} catch (err) {
				console.error("onnegotiationneeded error:", err);
			} finally {
				makingOffer.current = false;
			}
		};

		// remote track
		pc.current.ontrack = (event) => {
			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = event.streams[0];
				try {
					remoteVideoRef.current.play().catch(() => {});
				} catch {}
			}
		};

		// ICE candidates
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

		pc.current.onconnectionstatechange = () => {
			console.log("PC state:", pc.current?.connectionState);
		};

		// socket handlers
		socket.current.on("new-user", async (id, politeFlag) => {
			console.log("🔔 new-user:", id);
			setRemoteId(id);
			remoteIdRef.current = id;
			isPolite.current = politeFlag || false; // backend decides polite/impolite

			flushIceQueueTo(id);
		});

		socket.current.on("offer", async ({ sdp, from }) => {
			if (!from) return;
			setRemoteId(from);
			remoteIdRef.current = from;

			const offerCollision = makingOffer.current || pc.current.signalingState !== "stable";
			ignoreOffer.current = !isPolite.current && offerCollision;

			if (ignoreOffer.current) {
				console.warn("Ignoring offer due to collision");
				return;
			}

			try {
				if (offerCollision) {
					await Promise.all([
						pc.current.setLocalDescription({ type: "rollback" }),
						pc.current.setRemoteDescription(new RTCSessionDescription(sdp)),
					]);
				} else {
					await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
				}

				const answer = await pc.current.createAnswer();
				await pc.current.setLocalDescription(answer);
				socket.current.emit("answer", { sdp: pc.current.localDescription, to: from });
				console.log("📡 Answer sent to", from);
			} catch (err) {
				console.error("Error handling offer:", err);
			}
		});

		socket.current.on("answer", async ({ sdp, from }) => {
			try {
				await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
				flushIceQueueTo(from || remoteIdRef.current);
				console.log("📥 Answer received from", from);
			} catch (err) {
				console.error("Error setting remote description (answer):", err);
			}
		});

		socket.current.on("ice-candidate", async ({ candidate }) => {
			if (!candidate) return;
			try {
				await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (err) {
				console.error("Error adding ICE candidate:", err);
			}
		});

		// ✅ handle remote disconnect
		socket.current.on("user-disconnected", (id) => {
			console.log("❌ Remote user disconnected:", id);
			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = null;
			}
			try {
				pc.current?.close();
			} catch {}
			pc.current = null;
			remoteIdRef.current = null;
			setRemoteId(null);
		});

		// join room
		socket.current.emit("join-room", "my-room");

		return () => {
			try {
				pc.current?.close(); // ✅ close first
			} catch {}
			try {
				pc.current?.getSenders()?.forEach((s) => s.track?.stop());
			} catch {}
			try {
				localVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
				remoteVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
			} catch {}
			try {
				socket.current?.disconnect();
			} catch {}
		};
	}, []);

	// start video
	const startVideo = async () => {
		if (!navigator.mediaDevices?.getUserMedia) {
			alert("Camera/microphone not supported.");
			return;
		}
		if (localVideoRef.current?.srcObject) {
			console.log("📷 Video already started");
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			if (localVideoRef.current) {
				localVideoRef.current.srcObject = stream;
				try {
					localVideoRef.current.play().catch(() => {});
				} catch {}
			}

			stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));
		} catch (err) {
			console.error("Error accessing media devices:", err);
			alert("Please allow camera/microphone.");
		}
	};

	const toggleMute = () => {
		const newMuted = !isMuted;
		localVideoRef.current?.srcObject?.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
		setIsMuted(newMuted);
	};

	const toggleCamera = () => {
		const newCameraOn = !cameraOn;
		localVideoRef.current?.srcObject?.getVideoTracks().forEach((t) => (t.enabled = newCameraOn));
		setCameraOn(newCameraOn);
	};

	const copyText = (text) => navigator.clipboard.writeText(text);
	const speakText = (text, lang) => {
		speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = lang === "Filipino" ? "tl-PH" : "en-US";
		speechSynthesis.speak(utterance);
	};
	const toggleChatLang = (index) => {
		setTranslations((prev) =>
			prev.map((item, i) => (i === index ? { ...item, showLang: item.showLang === "En" ? "Fil" : "En" } : item))
		);
	};

	return (
		<div className="flex h-screen bg-gray-100 text-gray-900">
			<main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
				{/* Videos */}
				<div className="flex gap-6 w-full justify-center flex-wrap relative">
					{/* Local */}
					<div className="relative">
						<video
							ref={localVideoRef}
							autoPlay
							muted
							playsInline
							className="w-80 h-60 md:w-[35rem] md:h-[25rem] bg-black rounded-xl shadow-lg"
						/>
						<div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded flex items-center gap-2 text-sm">
							<span>You</span>
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
					<div className="relative">
						<video
							ref={remoteVideoRef}
							autoPlay
							playsInline
							className="w-80 h-60 md:w-[35rem] md:h-[25rem] bg-black rounded-xl shadow-lg"
						/>
						<div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded flex items-center gap-2 text-sm">
							<span>Remote</span>
							<FaMicrophone className="text-green-500" />
							<FaVideo className="text-green-500" />
						</div>
					</div>
				</div>

				{/* Controls */}
				<div className="flex gap-6">
					<button
						onClick={toggleMute}
						className={`flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-white transition-transform hover:scale-105 ${
							isMuted ? "bg-gray-500" : "bg-red-500"
						}`}
					>
						{isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
						<span>{isMuted ? "Unmute" : "Mute"}</span>
					</button>
					<button
						onClick={toggleCamera}
						className={`flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-white transition-transform hover:scale-105 ${
							cameraOn ? "bg-blue-500" : "bg-gray-500"
						}`}
					>
						{cameraOn ? <FaVideo /> : <FaVideoSlash />}
						<span>{cameraOn ? "Camera On" : "Camera Off"}</span>
					</button>
					<button
						onClick={startVideo}
						className="flex items-center gap-2 px-5 py-3 rounded-full bg-green-500 shadow-lg text-white transition-transform hover:scale-105"
					>
						<FaPhone /> <span>Start Call</span>
					</button>
				</div>

				{/* Live translation */}
				<div className="w-full max-w-4xl bg-white rounded-xl shadow p-4">
					<div className="flex justify-between items-center mb-2">
						<h3 className="text-md font-semibold">Live Translation</h3>
						<button
							onClick={() => setLiveTranslation("")}
							className="px-3 py-1 text-xs bg-red-500 text-white rounded shadow hover:bg-red-600"
						>
							Clear
						</button>
					</div>
					<div className="h-28 bg-gray-50 p-3 rounded-md border overflow-y-auto">
						<p className="text-gray-700">{liveTranslation || "Ongoing translation appears here..."}</p>
					</div>
				</div>
			</main>

			{/* Sidebar */}
			<aside className="w-80 flex-shrink-0 bg-white shadow-lg p-4 overflow-y-auto border-l border-gray-200 flex flex-col">
				<h2 className="text-lg font-semibold mb-4">Translation History</h2>
				<div className="flex flex-col gap-3">
					{translations.map((item, i) => {
						const textToShow = item.showLang === "En" ? item.textEn : item.textFil;
						const langLabel = item.showLang === "En" ? "English" : "Filipino";
						const alignment =
							item.sender === "local"
								? "self-end bg-blue-100 text-right"
								: "self-start bg-green-100 text-left";
						return (
							<div key={i} className={`p-3 rounded-lg shadow-sm max-w-[85%] ${alignment}`}>
								<p className="font-medium">{textToShow}</p>
								<p className="text-xs text-gray-600">{item.timestamp}</p>
								<p className="text-xs text-green-700">Accuracy: {item.accuracy}</p>
								<div className="flex gap-2 mt-2 justify-end">
									<button
										onClick={() => toggleChatLang(i)}
										className="px-2 py-1 text-xs bg-yellow-500 text-white rounded"
									>
										{langLabel} ↔ {item.showLang === "En" ? "Filipino" : "English"}
									</button>
									<button
										onClick={() => copyText(textToShow)}
										className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
									>
										Copy
									</button>
									<button
										onClick={() => speakText(textToShow, langLabel)}
										className="px-2 py-1 text-xs bg-gray-700 text-white rounded"
									>
										Speak
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
