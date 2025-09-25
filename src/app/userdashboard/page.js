"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth, db } from "../../utils/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";
import { Book, MessageSquare, User, LogOut, Camera, Home } from "lucide-react";

export default function UserDashboard() {
	const [userName, setUserName] = useState("");
	const [loading, setLoading] = useState(true);
	const [activeUsers, setActiveUsers] = useState(0);

	const pathname = usePathname();

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

			{/* Main Content */}
			<main className="flex-1 ml-64 p-8">
				{/* Header */}
				<header className="relative z-10 flex justify-between items-center mb-8 py-4">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {userName}!</h1>
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-red-500"
					>
						<LogOut className="w-5 h-5" /> Logout
					</button>
				</header>

				{/* Dashboard Cards (placeholders, no mock values) */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
					{["Total Translations", "Today's Translations", "Active Users", "Accuracy Rate"].map(
						(title, idx) => (
							<div key={idx} className={cardBaseClass}>
								<div>
									<p className="text-sm text-gray-700 dark:text-gray-400">{title}</p>
									<p className="text-2xl font-bold text-gray-900 dark:text-white">--</p>
								</div>
								<div className="w-12 h-12 bg-gray-900 dark:bg-gray-200 rounded-lg flex items-center justify-center">
									<User className="w-6 h-6 text-white dark:text-black" />
								</div>
							</div>
						)
					)}
				</div>

				{/* Sidebar Explanations (Navigation Guide) */}
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

				{/* Translation History (no mock items, empty placeholder) */}
				<div className="bg-white/90 dark:bg-gray-900/80 shadow-md rounded-3xl p-6">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Recent Translations</h3>
					<p className="text-sm text-gray-700 dark:text-gray-400 mb-4">Your latest ASL to text conversions</p>

					<div className="space-y-4">
						<p className="text-sm text-gray-500 dark:text-gray-400 italic">No recent translations yet.</p>
					</div>

					<button className="w-full mt-6 border-2 border-gray-200 dark:border-gray-700 rounded-2xl py-2 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
						View All History
					</button>
				</div>
			</main>
		</div>
	);
}
