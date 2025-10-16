"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Book, Camera, User, MessageSquare, HistoryIcon } from "lucide-react";

export default function GestureLibrary() {
	const [searchTerm, setSearchTerm] = useState("");
	const [filter, setFilter] = useState("all");
	const pathname = usePathname();

	const gestures = [
		{ title: "Letter A", category: "letters", type: "image", src: "/gestures/letters/A.png" },
		{ title: "Letter B", category: "letters", type: "image", src: "/gestures/letters/B.png" },
		{ title: "Number 1", category: "numbers", type: "image", src: "/gestures/numbers/1.png" },
		{ title: "Number 2", category: "numbers", type: "image", src: "/gestures/numbers/2.png" },
		{ title: "Hello", category: "words", type: "video", src: "/gestures/words/hello.mp4" },
		{ title: "Thank You", category: "words", type: "video", src: "/gestures/words/thankyou.mp4" },
		{ title: "Good Morning", category: "phrases", type: "video", src: "/gestures/phrases/goodmorning.mp4" },
		{ title: "How are you?", category: "phrases", type: "video", src: "/gestures/phrases/howareyou.mp4" },
	];

	const filteredGestures = gestures.filter((gesture) => {
		const matchesCategory = filter === "all" || gesture.category === filter;
		const matchesSearch = gesture.title.toLowerCase().includes(searchTerm.toLowerCase());
		return matchesCategory && matchesSearch;
	});

	const navItems = [
		{ href: "/userdashboard", label: "Home", icon: <Home className="w-5 h-5" /> },
		{ href: "/translation", label: "Translation", icon: <Camera className="w-5 h-5" /> },
		{ href: "/gesturelibrary", label: "Gesture Library", icon: <Book className="w-5 h-5" /> },
		{ href: "/feedback", label: "Feedback", icon: <MessageSquare className="w-5 h-5" /> },
		{ href: "/translationhistory", label: "Translation History", icon: <HistoryIcon className="w-5 h-5" /> },
		{ href: "/profile", label: "Profile", icon: <User className="w-5 h-5" /> },
	];

	const getLinkClasses = (href) =>
		`flex items-center gap-2 px-3 py-2 rounded-lg transition font-medium ${
			pathname === href
				? "bg-gray-900 text-white dark:bg-gray-200 dark:text-black shadow-md font-bold"
				: "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
		}`;

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
				<header className="text-center mb-10">
					<h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
						Gesture Library
					</h1>
					<p className="text-gray-700 dark:text-gray-400 opacity-80 max-w-2xl mx-auto">
						Explore letters, numbers, words, and phrases in American Sign Language.
					</p>
				</header>

				{/* Search Bar */}
				<div className="flex justify-center mb-6">
					<input
						type="text"
						placeholder="Search gestures..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="px-4 py-3 rounded-full w-full max-w-md focus:outline-none border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-gray-500 transition"
					/>
				</div>

				{/* Category Filter */}
				<div className="flex justify-center gap-3 flex-wrap mb-8">
					{["all", "letters", "numbers", "words", "phrases"].map((cat) => (
						<button
							key={cat}
							onClick={() => setFilter(cat)}
							className={`px-5 py-2 rounded-full font-semibold border transition-colors duration-300 ${
								filter === cat
									? "bg-gray-900 text-white dark:bg-gray-200 dark:text-black border-gray-900 dark:border-gray-200 shadow"
									: "bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
							}`}
						>
							{cat.charAt(0).toUpperCase() + cat.slice(1)}
						</button>
					))}
				</div>

				{/* Gesture Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
					{filteredGestures.map((gesture, idx) => (
						<div
							key={idx}
							className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow hover:shadow-lg transition-transform hover:-translate-y-1 bg-white dark:bg-gray-800"
						>
							{gesture.type === "image" ? (
								<img
									src={gesture.src}
									alt={gesture.title}
									className="w-full h-48 object-contain bg-gray-100 dark:bg-gray-900"
								/>
							) : (
								<video
									src={gesture.src}
									controls
									className="w-full h-48 object-contain bg-gray-100 dark:bg-gray-900"
								/>
							)}
							<div className="p-4 text-center">
								<h3 className="text-lg font-bold text-gray-900 dark:text-white">{gesture.title}</h3>
								<p className="text-sm text-gray-600 dark:text-gray-300 capitalize">
									{gesture.category}
								</p>
							</div>
						</div>
					))}
					{filteredGestures.length === 0 && (
						<p className="col-span-full text-center text-gray-700 dark:text-gray-300 mt-6">
							No gestures found.
						</p>
					)}
				</div>
			</main>
		</div>
	);
}
