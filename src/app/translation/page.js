"use client";
import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhone, FaCopy, FaVolumeUp } from "react-icons/fa";

const SOCKET_SERVER_URL = "https://backend-capstone-l19p.onrender.com";
const ASL_BACKEND_URL = "https://backend-web-service-5f90.onrender.com/predict";

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

		// Listen for shared translations
		socket.current.on("new-translation", (data) => {
			setTranslations((prev) => [...prev, data]);
		});

		pc.current = new RTCPeerConnection({
			iceServers: [
				{
					urls: "stun:stun.relay.metered.ca:80",
				},
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
					socket.current.emit("ice-candidate", { candidate: event.candidate, to: target });
				} else {
					iceQueue.current.push(event.candidate);
				}
			}
		};

		// Socket events for peer connection
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

		socket.current.emit("join-room", "my-room");
	};

	// Start camera + mic
	const startVideo = async () => {
		if (!navigator.mediaDevices?.getUserMedia) {
			alert("Camera/microphone not supported.");
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			if (localVideoRef.current) localVideoRef.current.srcObject = stream;

			const _pc = pc.current;
			if (!_pc) return;

			const existingSenders = _pc
				.getSenders()
				.map((s) => s.track)
				.filter(Boolean);
			stream.getTracks().forEach((track) => {
				const already = existingSenders.find((t) => t && t.kind === track.kind);
				if (!already) _pc.addTrack(track, stream);
			});

			if (remoteIdRef.current) {
				const offer = await _pc.createOffer();
				await _pc.setLocalDescription(offer);
				socket.current.emit("offer", { sdp: offer, to: remoteIdRef.current });
			}
		} catch (err) {
			console.error(err);
			alert("Please allow camera/microphone.");
		}
	};

	// Start / End call
	const handleCallToggle = async () => {
		if (!callActive) {
			if (pc.current) pc.current.close();
			pc.current = null;
			if (socket.current) socket.current.disconnect();
			socket.current = null;
			iceQueue.current = [];

			await initializeCall();
			await startVideo();
			setCallActive(true);
		} else {
			localVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
			localVideoRef.current.srcObject = null;

			remoteVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
			remoteVideoRef.current.srcObject = null;

			pc.current?.close();
			pc.current = null;

			socket.current?.disconnect();
			socket.current = null;

			remoteIdRef.current = null;
			setRemoteId(null);
			iceQueue.current = [];
			setCallActive(false);
		}
	};

	// Utils
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
		utterance.lang = lang === "Filipino" ? "fil-PH" : "en-US";
		speechSynthesis.speak(utterance);
	};
	const toggleChatLang = (index) => {
		setTranslations((prev) =>
			prev.map((item, i) => (i === index ? { ...item, showLang: item.showLang === "En" ? "Fil" : "En" } : item))
		);
	};

	useEffect(() => {
		if (!callActive) return;

		const intervalId = setInterval(async () => {
			if (!localVideoRef.current || localVideoRef.current.readyState !== 4) return;

			const canvas = document.createElement("canvas");
			canvas.width = localVideoRef.current.videoWidth;
			canvas.height = localVideoRef.current.videoHeight;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height);

			canvas.toBlob(async (blob) => {
				if (!blob) return;
				const formData = new FormData();
				formData.append("file", blob, "frame.jpg");

				try {
					const res = await fetch(ASL_BACKEND_URL, { method: "POST", body: formData });
					const data = await res.json();
					if (!data?.prediction) return;

					// Append new letter to buffer if changed
					setCurrentWord((prev) => {
						if (prev.endsWith(data.prediction)) return prev; // avoid duplicates
						return prev + data.prediction;
					});
				} catch (err) {
					console.error("Local prediction error:", err);
				}
			}, "image/jpeg");
		}, 1000);

		return () => clearInterval(intervalId);
	}, [callActive]);

	// Enter key handler for sending translation
	const sendTranslation = () => {
		if (!currentWord.trim() || !socket.current) return;

		const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		const translationObj = {
			sender: "local",
			textEn: currentWord,
			textFil: currentWord,
			timestamp,
			showLang: "En",
		};
		setTranslations((prev) => [...prev, translationObj]);
		socket.current.emit("new-translation", translationObj);
		setCurrentWord(""); // reset buffer
	};

	// Cleanup
	useEffect(() => {
		return () => {
			pc.current?.close();
			socket.current?.disconnect();
		};
	}, []);

	// --- UI remains unchanged, just replace the Enter button handler with sendTranslation ---
	// In the Live Translation panel:
	// onClick={() => sendTranslation()}

	return (
		<div className="flex h-screen bg-gray-100 text-gray-900">
			{/* Main video area */}
			<main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 mr-80">
				{/* Videos & Controls */}
				<div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl items-center justify-center">
					<div className="relative w-full md:w-1/2 max-w-md">
						<video
							ref={localVideoRef}
							autoPlay
							muted
							playsInline
							className="w-full aspect-video bg-black rounded-xl shadow-lg object-cover"
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
					<div className="relative w-full md:w-1/2 max-w-md">
						<video
							ref={remoteVideoRef}
							autoPlay
							playsInline
							className="w-full aspect-video bg-black rounded-xl shadow-lg object-cover"
						/>
						<div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded flex items-center gap-2 text-sm">
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
						{isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
						<span className="hidden md:inline">{isMuted ? "Unmute" : "Mute"}</span>
					</button>
					<button
						onClick={toggleCamera}
						className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-white ${
							cameraOn ? "bg-blue-500" : "bg-gray-500"
						}`}
					>
						{cameraOn ? <FaVideo /> : <FaVideoSlash />}
						<span className="hidden md:inline">{cameraOn ? "Camera On" : "Camera Off"}</span>
					</button>
					<button
						onClick={handleCallToggle}
						className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-white ${
							callActive ? "bg-red-500" : "bg-green-500"
						}`}
					>
						<FaPhone />
						<span className="hidden md:inline">{callActive ? "End Call" : "Start Call"}</span>
					</button>
				</div>

				{/* Live Translation */}
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
							<p className="text-gray-800 leading-relaxed">{currentWord}</p>
						) : (
							<p className="text-gray-400 italic">Ongoing translation appears here...</p>
						)}
					</div>
				</div>
			</main>

			{/* Sidebar */}
			<aside className="fixed top-0 right-0 h-full w-80 bg-white/95 shadow-xl p-6 overflow-y-auto border-l border-gray-200 flex flex-col">
				<h2 className="text-2xl font-bold mb-6 text-gray-900">Translation History</h2>
				<div className="flex flex-col gap-4">
					{translations.map((item, i) => {
						const textToShow = item.showLang === "En" ? item.textEn : item.textFil;
						const langLabel = item.showLang === "En" ? "English" : "Filipino";
						const alignment =
							item.sender === "local"
								? "self-end bg-blue-100 text-right"
								: "self-start bg-green-100 text-left";
						return (
							<div key={i} className={`p-4 rounded-2xl shadow-sm max-w-[85%] ${alignment}`}>
								<p className="font-medium text-gray-800 leading-snug">{textToShow}</p>
								<div className="flex justify-between items-center mt-2 text-xs text-gray-500">
									<span>{item.timestamp}</span>
								</div>
								<div className="flex gap-2 mt-3 justify-end flex-wrap">
									<button
										onClick={() => toggleChatLang(i)}
										className="px-2 py-1 text-xs bg-yellow-500 text-white rounded-full"
									>
										{langLabel} ↔ {item.showLang === "En" ? "Filipino" : "English"}
									</button>
									<button
										onClick={() => copyText(textToShow)}
										className="p-2 bg-blue-500 text-white rounded-full"
										title="Copy Text"
									>
										<FaCopy />
									</button>
									<button
										onClick={() => speakText(textToShow, langLabel)}
										className="p-2 bg-gray-700 text-white rounded-full"
										title="Speak Text"
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
