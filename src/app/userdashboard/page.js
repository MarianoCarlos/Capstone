"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth, db } from "../../utils/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
	collection,
	query,
	where,
	onSnapshot,
	Timestamp,
	serverTimestamp,
	doc,
	getDoc,
	setDoc,
	orderBy,
	limit,
} from "firebase/firestore";
import { Book, MessageSquare, User, LogOut, Camera, Home, History } from "lucide-react";

export default function UserDashboard() {
	const [userName, setUserName] = useState("");
	const [loading, setLoading] = useState(true);
	const [totalTranslations, setTotalTranslations] = useState(0);
	const [todaysTranslations, setTodaysTranslations] = useState(0);
	const [recentTranslations, setRecentTranslations] = useState([]);

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
		let unsubscribeTotal = null;
		let unsubscribeToday = null;

		const translationsRef = collection(db, "translations");

		// === TOTAL TRANSLATIONS ===
		const totalQ = query(translationsRef);
		unsubscribeTotal = onSnapshot(totalQ, (snapshot) => {
			setTotalTranslations(snapshot.size);
		});

		// === TODAY'S TRANSLATIONS ===
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const startOfDay = Timestamp.fromDate(today);

		const todayQ = query(translationsRef, where("timestamp", ">=", startOfDay));
		unsubscribeToday = onSnapshot(todayQ, (snapshot) => {
			setTodaysTranslations(snapshot.size);
		});

		// === RECENT TRANSLATIONS ===
		const recentQ = query(translationsRef, orderBy("timestamp", "desc"), limit(5));
		const unsubscribeRecent = onSnapshot(recentQ, (snapshot) => {
			const data = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));
			setRecentTranslations(data);
		});

		// Track Auth User (for greeting only)
		const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				const userRef = doc(db, "users", user.uid);
				await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });

				const docSnap = await getDoc(userRef);
				if (docSnap.exists()) {
					const data = docSnap.data();
					setUserName(`${data.firstName || ""} ${data.lastName || ""}`);
				} else {
					setUserName(user.displayName || "");
				}
			} else {
				window.location.href = "/login";
			}
			setLoading(false);
		});

		return () => {
			if (unsubscribeTotal) unsubscribeTotal();
			if (unsubscribeToday) unsubscribeToday();
			if (unsubscribeRecent) unsubscribeRecent();
			unsubscribeAuth();
		};
	}, []);

	const handleLogout = async () => {
		await signOut(auth);
		window.location.href = "/login";
	};

	if (loading) return <p className="text-center mt-10">Loading...</p>;

	const cardBaseClass =
		"flex items-center justify-between p-6 bg-white/90 dark:bg-gray-900/80 rounded-3xl shadow-lg hover:shadow-xl backdrop-blur-md border border-gray-200 dark:border-gray-700 transition-transform hover:-translate-y-1 font-sans";

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
				<header className="relative z-10 flex justify-between items-center mb-8 py-4">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {userName || "User"}!</h1>
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-red-500"
					>
						<LogOut className="w-5 h-5" /> Logout
					</button>
				</header>

				{/* Dashboard Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-10">
					{/* Total Translations */}
					<div className={cardBaseClass}>
						<div>
							<p className="text-sm text-gray-700 dark:text-gray-400">Total Translations</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-white">
								{totalTranslations ?? "--"}
							</p>
						</div>
						<div className="w-12 h-12 bg-gray-900 dark:bg-gray-200 rounded-lg flex items-center justify-center">
							<User className="w-6 h-6 text-white dark:text-black" />
						</div>
					</div>

					{/* Today's Translations */}
					<div className={cardBaseClass}>
						<div>
							<p className="text-sm text-gray-700 dark:text-gray-400">Today's Translations</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-white">
								{todaysTranslations ?? "--"}
							</p>
						</div>
						<div className="w-12 h-12 bg-gray-900 dark:bg-gray-200 rounded-lg flex items-center justify-center">
							<User className="w-6 h-6 text-white dark:text-black" />
						</div>
					</div>
				</div>
				{/* Navigation Guide */}
				<div className="mb-10">
					<div className="mb-6">
						<h3 className="text-xl font-bold tracking-wide text-gray-900 dark:text-white">
							Navigation Guide
						</h3>
						<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
							Get familiar with each section of the dashboard so you know exactly where to go.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{/* Home */}
						<Link
							href="/userdashboard"
							className="block p-6 bg-white/90 dark:bg-gray-900/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg hover:translate-y-1 transition"
						>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
								<Home className="w-5 h-5 text-gray-700 dark:text-gray-300" /> Home
							</h4>
							<p className="text-base text-gray-700 dark:text-gray-400 leading-relaxed">
								View an overview of your <span className="font-medium">activity</span>, translation{" "}
								<span className="font-medium">stats</span>, and recent{" "}
								<span className="font-medium">performance</span>.
							</p>
						</Link>

						{/* Translation */}
						<Link
							href="/translation"
							className="block p-6 bg-white/90 dark:bg-gray-900/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg hover:translate-y-1 transition"
						>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
								<Camera className="w-5 h-5 text-gray-700 dark:text-gray-300" /> Translation
							</h4>
							<p className="text-base text-gray-700 dark:text-gray-400 leading-relaxed">
								Open the live camera to translate <span className="font-medium">ASL gestures</span> into
								text instantly.
							</p>
						</Link>

						{/* Gesture Library */}
						<Link
							href="/gesturelibrary"
							className="block p-6 bg-white/90 dark:bg-gray-900/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg hover:translate-y-1 transition"
						>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
								<Book className="w-5 h-5 text-gray-700 dark:text-gray-300" /> Gesture Library
							</h4>
							<p className="text-base text-gray-700 dark:text-gray-400 leading-relaxed">
								Browse and learn <span className="font-medium">ASL gestures</span> with explanations and
								practice examples.
							</p>
						</Link>

						{/* Feedback */}
						<Link
							href="/feedback"
							className="block p-6 bg-white/90 dark:bg-gray-900/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg hover:translate-y-1 transition"
						>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
								<MessageSquare className="w-5 h-5 text-gray-700 dark:text-gray-300" /> Feedback
							</h4>
							<p className="text-base text-gray-700 dark:text-gray-400 leading-relaxed">
								Share your <span className="font-medium">feedback</span> or report issues to help us
								improve.
							</p>
						</Link>

						{/* Profile */}
						<Link
							href="/profile"
							className="block p-6 bg-white/90 dark:bg-gray-900/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg hover:translate-y-1 transition lg:col-span-2"
						>
							<h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
								<User className="w-5 h-5 text-gray-700 dark:text-gray-300" /> Profile
							</h4>
							<p className="text-base text-gray-700 dark:text-gray-400 leading-relaxed">
								Manage your <span className="font-medium">account settings</span>, preferences, and
								personal <span className="font-medium">information</span>.
							</p>
						</Link>
					</div>
				</div>

				{/* Recent Translations */}
				<div className="bg-white/90 dark:bg-gray-900/80 shadow-md rounded-3xl p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Recent Translations</h3>
					<p className="text-sm text-gray-700 dark:text-gray-400 mb-4">Your latest ASL to text conversions</p>

					<div className="space-y-4">
						{recentTranslations.length === 0 ? (
							<p className="text-sm text-gray-500 dark:text-gray-400 italic">
								No recent translations yet.
							</p>
						) : (
							recentTranslations.map((t) => (
								<div
									key={t.id}
									className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-transform hover:-translate-y-1"
								>
									<div className="flex justify-between items-center mb-2">
										<p className="font-semibold text-gray-900 dark:text-white">
											{t.sender || "Anonymous"}
										</p>
										<span className="text-xs text-gray-500 dark:text-gray-400">
											{t.timestamp
												? (() => {
														const dateObj = t.timestamp.toDate
															? t.timestamp.toDate()
															: new Date(t.timestamp);

														// ✅ Format: DD/MM/YYYY - HH:MM AM/PM
														const datePart = `${String(dateObj.getDate()).padStart(
															2,
															"0"
														)}/${String(dateObj.getMonth() + 1).padStart(
															2,
															"0"
														)}/${dateObj.getFullYear()}`;

														const timePart = dateObj.toLocaleTimeString([], {
															hour: "2-digit",
															minute: "2-digit",
															hour12: true,
														});

														return `${datePart} - ${timePart}`;
												  })()
												: "Pending"}
										</span>
									</div>
									<p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
										{t.text || "No translation data"}
									</p>
								</div>
							))
						)}
					</div>

					<Link
						href="/translationhistory"
						className="block w-full mt-6 border-2 border-gray-200 dark:border-gray-700 rounded-2xl py-2 text-center text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium"
					>
						View All History
					</Link>
				</div>
			</main>
		</div>
	);
}
