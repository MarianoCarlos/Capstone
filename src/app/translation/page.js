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

const SOCKET_SERVER_URL = "https://backend-capstone-l19p.onrender.com";
const ASL_BACKEND_URL = "https://words-backend-hosting.onrender.com/predict";

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

	// ✅ invite system
	const [inviteCode, setInviteCode] = useState("");
	const [isRoomJoined, setIsRoomJoined] = useState(false);

	// Flush queued ICE candidates
	const flushIceQueueTo = (id) => {
		if (!socket.current || !id) return;
		iceQueue.current.forEach((candidate) => socket.current.emit("ice-candidate", { candidate, to: id }));
		iceQueue.current = [];
	};

	// Initialize socket + peer connection
	const initializeCall = async () => {
		socket.current = io(SOCKET_SERVER_URL);

		socket.current.on("connect", () => console.log("✅ Connected:", socket.current.id));
		socket.current.on("connect_error", (err) => console.warn("Socket error:", err));

		socket.current.on("new-translation", (data) => {
			setTranslations((prev) => [...prev, data]);
		});

		pc.current = new RTCPeerConnection({
			iceServers: [
				{ urls: "stun:stun.relay.metered.ca:80" },
				{
					urls: "turn:global.relay.metered.ca:80",
					username: "d32a9a3a2410a9814d92f496",
					credential: "1pHpTSjADEGTm86/",
				},
				{
					urls: "turn:global.relay.metered.ca:443",
					username: "d32a9a3a2410a9814d92f496",
					credential: "1pHpTSjADEGTm86/",
				},
			],
		});

		const getPc = () => pc.current;

		pc.current.onnegotiationneeded = async () => {
			try {
				const _pc = getPc();
				if (!_pc) return;
				const target = remoteIdRef.current;
				if (!target) return;
				const offer = await _pc.createOffer();
				await _pc.setLocalDescription(offer);
				socket.current.emit("offer", { sdp: offer, to: target });
			} catch (err) {
				console.error("Negotiation error:", err);
			}
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
					socket.current.emit("ice-candidate", {
						candidate: event.candidate,
						to: target,
					});
				} else {
					iceQueue.current.push(event.candidate);
				}
			}
		};

		socket.current.on("new-user", async (id) => {
			setRemoteId(id);
			remoteIdRef.current = id;
			flushIceQueueTo(id);

			if (localVideoRef.current?.srcObject) {
				try {
					const _pc = getPc();
					if (!_pc) return;
					const offer = await _pc.createOffer();
					await _pc.setLocalDescription(offer);
					socket.current.emit("offer", { sdp: offer, to: id });
				} catch (err) {
					console.error(err);
				}
			}
		});

		socket.current.on("offer", async (data) => {
			const fromId = data.from || data.sender || data.fromId;
			if (!fromId) return;
			setRemoteId(fromId);
			remoteIdRef.current = fromId;
			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
				flushIceQueueTo(fromId);
				const answer = await _pc.createAnswer();
				await _pc.setLocalDescription(answer);
				socket.current.emit("answer", { sdp: answer, to: fromId });
			} catch (err) {
				console.error(err);
			}
		});

		socket.current.on("answer", async (data) => {
			const fromId = data.from || data.sender || data.fromId;
			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
				flushIceQueueTo(fromId || remoteIdRef.current);
			} catch (err) {
				console.error(err);
			}
		});

		socket.current.on("ice-candidate", async ({ candidate }) => {
			if (!candidate) return;
			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (err) {
				console.error(err);
			}
		});

		if (inviteCode.trim()) {
			socket.current.emit("join-room", inviteCode.trim());
			setIsRoomJoined(true);
			console.log("🟢 Joined room:", inviteCode);
		} else {
			alert("Please enter an invite code first!");
		}
	};

	// Start camera + mic
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

	// Start / End call
	const handleCallToggle = async () => {
		if (!callActive) {
			if (!inviteCode.trim()) {
				alert("Enter or generate an invite code first!");
				return;
			}
			await initializeCall();
			await startVideo();
			setCallActive(true);
		} else {
			localVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
			remoteVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
			pc.current?.close();
			socket.current?.disconnect();
			setCallActive(false);
			setIsRoomJoined(false);
		}
	};

	// Mute/Camera
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

	// Speech + Clipboard
	const copyText = (text) => navigator.clipboard.writeText(text);
	const speakText = (text) => {
		speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = "en-US";
		speechSynthesis.speak(u);
	};

	// === Frame Capture & Prediction ===
	useEffect(() => {
		if (!callActive) return;
		const interval = setInterval(async () => {
			if (!localVideoRef.current || localVideoRef.current.readyState !== 4) return;
			const canvas = document.createElement("canvas");
			canvas.width = 224;
			canvas.height = 224;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(localVideoRef.current, 0, 0, 224, 224);

			canvas.toBlob(async (blob) => {
				if (!blob) return;
				const formData = new FormData();
				formData.append("file", blob, "frame.jpg");

				try {
					const res = await fetch(ASL_BACKEND_URL, { method: "POST", body: formData });
					const data = await res.json();
					if (!data?.prediction) return;

					setCurrentWord((prev) => {
						if (prev.slice(-1) === data.prediction) return prev;
						return prev + data.prediction;
					});
				} catch (err) {
					console.error(err);
				}
			}, "image/jpeg");
		}, 1000);
		return () => clearInterval(interval);
	}, [callActive]);

	// Send live translation
	const sendTranslation = () => {
		if (!currentWord.trim() || !socket.current) return;
		const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		const obj = { sender: "local", text: currentWord, timestamp };
		setTranslations((p) => [...p, obj]);
		socket.current.emit("new-translation", obj);
		setCurrentWord("");
	};

	// ✅ Send manual chat message
	const sendChatMessage = () => {
		if (!manualMessage.trim() || !socket.current) return;
		const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		const obj = { sender: "local", text: manualMessage, timestamp };
		setTranslations((p) => [...p, obj]);
		socket.current.emit("new-translation", obj);
		setManualMessage("");
	};

	useEffect(() => {
		return () => {
			pc.current?.close();
			socket.current?.disconnect();
		};
	}, []);

	// --- UI unchanged, only added chat input below ---
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

			{/* Main content */}
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
					<div className="relative w-full md:w-1/2 max-w-md">
						<video
							ref={remoteVideoRef}
							autoPlay
							playsInline
							className="w-full aspect-video bg-black rounded-xl shadow-lg object-cover"
						/>
						<div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2 text-sm">
							<span>Remote</span>
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

				{/* Live Translation + Chat */}
				<div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-5 flex flex-col mt-4">
					<div className="flex justify-between items-center mb-3">
						<h3 className="text-lg font-semibold text-gray-800">Live Translation</h3>
						<div className="flex gap-2">
							<button
								onClick={sendTranslation}
								className="px-3 py-1 text-xs bg-green-500 text-white rounded-full"
							>
								Enter
							</button>
							<button
								onClick={() => setCurrentWord("")}
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

					{/* ✅ Chat input */}
					<div className="flex items-center gap-3 mt-4">
						<input
							type="text"
							value={manualMessage}
							onChange={(e) => setManualMessage(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
							placeholder="Type a message..."
							className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
						/>
						<button
							onClick={sendChatMessage}
							className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm shadow hover:bg-blue-600"
						>
							Send
						</button>
					</div>
				</div>
			</main>

			{/* Right Sidebar */}
			<aside className="fixed top-0 right-0 h-full w-80 bg-white/95 shadow-xl p-6 overflow-y-auto border-l border-gray-200 flex flex-col">
				<h2 className="text-2xl font-bold mb-6 text-gray-900">Translation History</h2>
				<div className="flex flex-col gap-4">
					{translations.map((item, i) => {
						const align =
							item.sender === "local"
								? "self-end bg-blue-100 text-right"
								: "self-start bg-green-100 text-left";
						return (
							<div key={i} className={`p-4 rounded-2xl shadow-sm max-w-[85%] ${align}`}>
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
