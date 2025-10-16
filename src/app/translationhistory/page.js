"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { db, auth } from "@/utils/firebaseConfig";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Book, MessageSquare, User, LogOut, Camera, Home, History, ChevronDown, ChevronRight } from "lucide-react";

export default function TranslationHistoryPage() {
	const [groupedTranslations, setGroupedTranslations] = useState({});
	const [expandedRooms, setExpandedRooms] = useState({});
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState("");

	const pathname = usePathname();

	const navItems = [
		{ href: "/userdashboard", label: "Home", icon: <Home className="w-5 h-5" /> },
		{ href: "/translation", label: "Translation", icon: <Camera className="w-5 h-5" /> },
		{ href: "/gesturelibrary", label: "Gesture Library", icon: <Book className="w-5 h-5" /> },
		{ href: "/feedback", label: "Feedback", icon: <MessageSquare className="w-5 h-5" /> },
		{ href: "/translationhistory", label: "Translation History", icon: <History className="w-5 h-5" /> },
		{ href: "/profile", label: "Profile", icon: <User className="w-5 h-5" /> },
	];

	const getLinkClasses = (href) =>
		`flex items-center gap-2 px-3 py-2 rounded-lg transition font-medium ${
			pathname === href
				? "bg-gray-900 text-white dark:bg-gray-200 dark:text-black shadow-md font-bold"
				: "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
		}`;

	useEffect(() => {
		let unsubscribeAuth;
		let unsubscribeTranslations;

		unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
			if (currentUser) {
				setUserName(currentUser.displayName || currentUser.email || "User");

				const translationsRef = collection(db, "translations");
				const q = query(translationsRef, orderBy("timestamp", "desc"));

				unsubscribeTranslations = onSnapshot(q, (snapshot) => {
					const data = snapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}));

					// Group by room
					const grouped = data.reduce((acc, t) => {
						const room = t.room || "Unknown Room";
						if (!acc[room]) acc[room] = [];
						acc[room].push(t);
						return acc;
					}, {});

					setGroupedTranslations(grouped);
					setLoading(false);
				});
			} else {
				window.location.href = "/login";
			}
		});

		return () => {
			if (unsubscribeAuth) unsubscribeAuth();
			if (unsubscribeTranslations) unsubscribeTranslations();
		};
	}, []);

	const handleLogout = async () => {
		await signOut(auth);
		window.location.href = "/login";
	};

	const toggleRoom = (room) => {
		setExpandedRooms((prev) => ({ ...prev, [room]: !prev[room] }));
	};

	return (
		<div className="min-h-screen flex bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-gray-900 font-sans">
			{/* Sidebar */}
			<aside className="fixed top-0 left-0 h-full w-64 bg-white/90 dark:bg-gray-900/80 shadow-md p-6 hidden md:flex flex-col">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h2>
				<nav className="flex flex-col gap-3 flex-1">
					{navItems.map((item) => (
						<Link key={item.href} href={item.href} className={getLinkClasses(item.href)}>
							{item.icon} {item.label}
						</Link>
					))}
				</nav>
			</aside>

			{/* Main Content */}
			<main className="flex-1 ml-64 p-8">
				<header className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {userName}!</h1>
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-red-500"
					>
						<LogOut className="w-5 h-5" /> Logout
					</button>
				</header>

				{/* History Content */}
				<div className="max-w-5xl mx-auto bg-white/90 dark:bg-gray-900/80 shadow-md rounded-3xl p-8 border border-gray-200 dark:border-gray-700 backdrop-blur-md">
					<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
						Translation History by Room
					</h2>
					<p className="text-center text-gray-700 dark:text-gray-400 mb-10">
						View all room-based ASL → Text translations
					</p>

					{loading ? (
						<p className="text-center text-gray-500 dark:text-gray-400">Loading...</p>
					) : Object.keys(groupedTranslations).length === 0 ? (
						<p className="text-center italic text-gray-500 dark:text-gray-400">
							No translations found yet.
						</p>
					) : (
						<div className="space-y-8">
							{Object.entries(groupedTranslations).map(([room, messages]) => (
								<div
									key={room}
									className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-transform"
								>
									{/* Room Header */}
									<button
										onClick={() => toggleRoom(room)}
										className="flex justify-between items-center w-full mb-4 border-b border-gray-300 dark:border-gray-700 pb-2"
									>
										<h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
											Room: {room}
										</h3>
										{expandedRooms[room] ? (
											<ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
										) : (
											<ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
										)}
									</button>

									{/* Messages */}
									{expandedRooms[room] && (
										<div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
											{messages.map((t, index) => (
												<div
													key={t.id}
													className={`p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col max-w-[90%] ${
														index % 2 === 0
															? "ml-auto bg-gray-50 dark:bg-gray-900/50"
															: "mr-auto bg-gray-100 dark:bg-gray-900/70"
													}`}
												>
													<div className="flex justify-between items-center mb-1">
														<p className="font-semibold text-gray-900 dark:text-white">
															{t.sender || "Anonymous"}
														</p>
														<span className="text-xs text-gray-500 dark:text-gray-400">
															{t.timestamp?.toDate
																? t.timestamp.toDate().toLocaleString()
																: "Pending"}
														</span>
													</div>
													<p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
														{t.text || ""}
													</p>
												</div>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
