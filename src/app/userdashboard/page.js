"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth, db } from "../../utils/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";
import { Book, MessageSquare, User, LogOut, Camera, Play, Volume2, Eye, Home } from "lucide-react";

export default function UserDashboard() {
	const [userName, setUserName] = useState("");
	const [loading, setLoading] = useState(true);
	const [activeUsers, setActiveUsers] = useState(0);

	const pathname = usePathname();

	const translationHistory = [
		{ id: 1, text: '"Hello"', timeAgo: "2 mins ago", accuracy: "95%", language: "English" },
		{ id: 2, text: '"Salamat"', timeAgo: "1 hour ago", accuracy: "92%", language: "Filipino" },
		{ id: 3, text: '"Yes"', timeAgo: "1 day ago", accuracy: "98%", language: "English" },
		{ id: 4, text: '"Hindi"', timeAgo: "3 days ago", accuracy: "90%", language: "Filipino" },
	];

	const navItems = [
		{ href: "/userdashboard", label: "Home", icon: <Home className="w-5 h-5" /> },
		{ href: "/translation", label: "Translation", icon: <Camera className="w-5 h-5" /> },
		{ href: "/gesturelibrary", label: "Gesture Library", icon: <Book className="w-5 h-5" /> },
		{ href: "/feedback", label: "Feedback", icon: <MessageSquare className="w-5 h-5" /> },
		{ href: "/profile", label: "Profile", icon: <User className="w-5 h-5" /> },
	];

	// Sidebar highlight styling
	const getLinkClasses = (href) =>
		`flex items-center gap-2 px-3 py-2 rounded-lg transition font-medium ${
			pathname === href
				? "bg-gray-900 text-white dark:bg-gray-200 dark:text-black shadow-md font-bold"
				: "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
		}`;

	const averageAccuracy =
		translationHistory.reduce((sum, t) => sum + parseInt(t.accuracy), 0) / translationHistory.length;

	useEffect(() => {
		let unsubscribeActiveUsers;
		let interval;

		const trackUser = async (user) => {
			const userRef = doc(db, "users", user.uid);

			await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });

			const docSnap = await getDoc(userRef);
			if (docSnap.exists()) {
				const data = docSnap.data();
				setUserName(`${data.firstName || ""} ${data.lastName || ""}`);
			} else {
				setUserName(user.displayName || "");
			}

			const usersRef = collection(db, "users");
			const q = query(usersRef, where("lastActive", ">", new Date(Date.now() - 60000)));
			unsubscribeActiveUsers = onSnapshot(q, (snapshot) => {
				setActiveUsers(snapshot.size);
			});

			interval = setInterval(() => {
				setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
			}, 30000);

			setLoading(false);
		};

		const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
			if (user) {
				trackUser(user);
			} else {
				window.location.href = "/login";
				setLoading(false);
			}
		});

		return () => {
			unsubscribeAuth();
			if (unsubscribeActiveUsers) unsubscribeActiveUsers();
			if (interval) clearInterval(interval);
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
			{/* Sidebar (Fixed) */}
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

			{/* Main Content (with left padding so it doesn't overlap the fixed sidebar) */}
			<main className="flex-1 ml-64 p-8">
				{/* Header (Not Sticky) */}
				<header className="relative bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-gray-900 z-10 flex justify-between items-center mb-8 py-4">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {userName}!</h1>
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-red-500"
					>
						<LogOut className="w-5 h-5" /> Logout
					</button>
				</header>

				{/* Dashboard Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
					{[
						{ title: "Total Translations", value: 23 },
						{ title: "Today's Translations", value: 15 },
						{ title: "Active Users", value: activeUsers },
						{ title: "Accuracy Rate", value: `${averageAccuracy.toFixed(1)}%` },
					].map((card, idx) => (
						<div key={idx} className={cardBaseClass}>
							<div>
								<p className="text-sm text-gray-700 dark:text-gray-400">{card.title}</p>
								<p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
							</div>
							<div className="w-12 h-12 bg-gray-900 dark:bg-gray-200 rounded-lg flex items-center justify-center">
								<User className="w-6 h-6 text-white dark:text-black" />
							</div>
						</div>
					))}
				</div>

				{/* Quick Actions */}
				<div className="mb-10">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
						{[
							{
								title: "Feedback",
								href: "/feedback",
								icon: <MessageSquare className="w-6 h-6 text-white" />,
							},
							{
								title: "Gesture Library",
								href: "/gesturelibrary",
								icon: <Book className="w-6 h-6 text-white" />,
							},
							{
								title: "Translation History",
								href: "/translation-history",
								icon: <User className="w-6 h-6 text-white" />,
							},
							{
								title: "Translation Camera",
								href: "/translation",
								icon: <Camera className="w-6 h-6 text-white" />,
							},
						].map((action, idx) => (
							<Link key={idx} href={action.href} className={cardBaseClass}>
								<div>
									<p className="text-sm text-gray-700 dark:text-gray-400">{action.title}</p>
								</div>
								<div className="w-12 h-12 bg-gray-900 dark:bg-gray-200 rounded-lg flex items-center justify-center">
									{action.icon}
								</div>
							</Link>
						))}
					</div>
				</div>

				{/* Translation History */}
				<div className="bg-white/90 dark:bg-gray-900/80 shadow-md rounded-3xl p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Recent Translations</h3>
					<p className="text-sm text-gray-700 dark:text-gray-400 mb-4">Your latest ASL to text conversions</p>
					<div className="space-y-4">
						{translationHistory.map((t) => (
							<div
								key={t.id}
								className="flex items-center justify-between p-4 bg-white/80 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
							>
								<div className="flex-1">
									<p className="font-medium text-gray-900 dark:text-white">{t.text}</p>
									<div className="flex items-center space-x-4 mt-1">
										<span className="text-sm text-gray-700 dark:text-gray-400">{t.timeAgo}</span>
										<span className="px-2 py-0.5 border rounded text-xs text-gray-900 dark:text-gray-200">
											{t.language}
										</span>
										<span className="text-sm text-green-600 dark:text-green-400">
											{t.accuracy} accuracy
										</span>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
										<Play className="w-4 h-4" />
									</button>
									<button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
										<Volume2 className="w-4 h-4" />
									</button>
									<button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
										<Eye className="w-4 h-4" />
									</button>
								</div>
							</div>
						))}
					</div>
					<button className="w-full mt-4 border-2 border-white/60 rounded-3xl py-2 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 font-sans">
						View All History
					</button>
				</div>
			</main>
		</div>
	);
}
