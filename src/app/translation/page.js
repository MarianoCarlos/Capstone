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
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});

		// Safety: ensure pc exists in handlers
		const getPc = () => pc.current;

		// When negotiation is needed (e.g. after adding tracks), create/send an offer
		pc.current.onnegotiationneeded = async () => {
			try {
				const _pc = getPc();
				if (!_pc) return;
				const target = remoteIdRef.current;
				if (!target) return; // nothing to offer to
				const offer = await _pc.createOffer();
				await _pc.setLocalDescription(offer);
				socket.current.emit("offer", { sdp: offer, to: target });
				console.log("🔀 Sent offer (onnegotiationneeded) to", target);
			} catch (err) {
				console.error("onnegotiationneeded error:", err);
			}
		};

		// Handle remote stream
		pc.current.ontrack = (event) => {
			console.log("📹 ontrack event", event);
			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = event.streams[0];
				// try to play (autoplay policies)
				try {
					remoteVideoRef.current.play().catch(() => {});
				} catch (e) {}
			}
		};

		// ICE candidates - send or queue
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

		// Optional: log connection state
		pc.current.onconnectionstatechange = () => {
			console.log("PC state:", pc.current?.connectionState);
		};

		// Socket handlers
		socket.current.on("new-user", async (id) => {
			console.log("🔔 new-user:", id);
			setRemoteId(id);
			remoteIdRef.current = id;

			// flush ICE candidates to them
			flushIceQueueTo(id);

			// create offer if we already have local media
			if (localVideoRef.current?.srcObject) {
				try {
					const _pc = getPc();
					if (!_pc) return;
					const offer = await _pc.createOffer();
					await _pc.setLocalDescription(offer);
					socket.current.emit("offer", { sdp: offer, to: id });
					console.log("📡 Offer sent to", id);
				} catch (err) {
					console.error("Error creating offer on new-user:", err);
				}
			}
		});

		socket.current.on("offer", async (data) => {
			const fromId = data.from || data.sender || data.fromId;
			if (!fromId) {
				console.warn("offer without from id:", data);
				return;
			}
			console.log("📥 offer received from", fromId);
			setRemoteId(fromId);
			remoteIdRef.current = fromId;

			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
				// flush any queued ICE candidates now that remote description is set
				flushIceQueueTo(fromId);

				const answer = await _pc.createAnswer();
				await _pc.setLocalDescription(answer);
				socket.current.emit("answer", { sdp: answer, to: fromId });
				console.log("📡 answer sent to", fromId);
			} catch (err) {
				console.error("Error handling offer:", err);
			}
		});

		socket.current.on("answer", async (data) => {
			const fromId = data.from || data.sender || data.fromId;
			console.log("📥 answer received from", fromId);
			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
				// flush ICE queue (in case we queued before knowing remote id)
				flushIceQueueTo(fromId || remoteIdRef.current);
			} catch (err) {
				console.error("Error setting remote description (answer):", err);
			}
		});

		socket.current.on("ice-candidate", async ({ candidate, from }) => {
			// note: server now sends { candidate, from } - but be defensive
			if (!candidate) return;
			try {
				const _pc = getPc();
				if (!_pc) return;
				await _pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (err) {
				console.error("Error adding ICE candidate:", err);
			}
		});

		// Join room
		socket.current.emit("join-room", "my-room");

		// cleanup
		return () => {
			try {
				socket.current?.disconnect();
			} catch (e) {}
			try {
				// stop senders' tracks
				pc.current?.getSenders()?.forEach((s) => {
					try {
						s.track?.stop();
					} catch {}
				});
				pc.current?.close();
			} catch (e) {}
			try {
				localVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
				remoteVideoRef.current?.srcObject?.getTracks()?.forEach((t) => t.stop());
			} catch (e) {}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const startVideo = async () => {
		if (!navigator.mediaDevices?.getUserMedia) {
			alert("Camera/microphone not supported.");
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true,
			});
			if (localVideoRef.current) {
				localVideoRef.current.srcObject = stream;
				try {
					localVideoRef.current.play().catch(() => {});
				} catch (e) {}
			}

			// add tracks to peer connection (this will trigger onnegotiationneeded)
			const _pc = pc.current;
			if (!_pc) {
				console.warn("No RTCPeerConnection instance");
				return;
			}

			// Add tracks -- avoid duplicate add if already added
			const existingSenders = _pc
				.getSenders()
				.map((s) => s.track)
				.filter(Boolean);
			stream.getTracks().forEach((track) => {
				// if same kind is already being sent, skip adding duplicate
				const already = existingSenders.find((t) => t && t.kind === track.kind);
				if (!already) _pc.addTrack(track, stream);
			});

			// If a remote peer is already known, explicitly create an offer (some browsers require it)
			if (remoteIdRef.current) {
				try {
					const offer = await _pc.createOffer();
					await _pc.setLocalDescription(offer);
					socket.current.emit("offer", { sdp: offer, to: remoteIdRef.current });
					console.log("📡 Offer sent after startVideo to", remoteIdRef.current);
				} catch (err) {
					console.error("Error creating offer after startVideo:", err);
				}
			}
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
		utterance.lang = lang === "Filipino" ? "fil-PH" : "en-US";
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
								<FaVideo className="textGreen-500" />
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
