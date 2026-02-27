"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Book, Camera, User, MessageSquare, HistoryIcon } from "lucide-react";

export default function GestureLibrary() {
	const [gestures, setGestures] = useState([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [filter, setFilter] = useState("all");
	const [loading, setLoading] = useState(true);
	const [imageErrors, setImageErrors] = useState(new Set());
	const pathname = usePathname();

	// �️ Fetch gestures from assets API
	useEffect(() => {
		const fetchGestures = async () => {
			try {
				const response = await fetch("/api/gestures");
				const data = await response.json();
				setGestures(data);
			} catch (error) {
				console.error("❌ Error fetching gestures:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchGestures();
	}, []);

	// 🔍 Filter & search gestures
	const filteredGestures = gestures.filter((gesture) => {
		const matchesCategory = filter === "all" || gesture.category === filter;
		const matchesSearch = gesture.title?.toLowerCase().includes(searchTerm.toLowerCase());
		return matchesCategory && matchesSearch;
	});

	// 📱 Sidebar Navigation
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
				{loading ? (
					<p className="text-center text-gray-600 dark:text-gray-400">Loading gestures...</p>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
						{filteredGestures.map((gesture) => {
							// Use the image source directly from the gesture object
							const assetImageUrl = gesture.src;

							const hasImageError = imageErrors.has(gesture.id);
							const handleImageError = () => {
								console.warn(`❌ Missing image for gesture: "${gesture.title}" - Expected: ${assetImageUrl}`);
								setImageErrors(prev => new Set(prev).add(gesture.id));
							};

							return (
								<div
									key={gesture.id}
									className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow hover:shadow-lg transition-all hover:-translate-y-1 bg-white dark:bg-gray-800 flex flex-col h-full"
								>
									{/* Asset Image Section */}
									<div className="relative w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
										{!hasImageError ? (
											<img
												src={assetImageUrl}
												alt={gesture.title}
												className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
												onError={handleImageError}
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center">
												<div className="text-center text-gray-500 dark:text-gray-400 px-2">
													<p className="text-sm">Image not found</p>
											<p className="text-xs opacity-60">{gesture.title.trim()}</p>
												</div>
											</div>
										)}
									</div>

									{/* Gesture Info */}
									<div className="p-4 text-center flex-grow flex flex-col justify-center">
										<h3 className="text-lg font-bold text-gray-900 dark:text-white">{gesture.title}</h3>
										<p className="text-sm text-gray-600 dark:text-gray-300 capitalize">{gesture.category}</p>
									</div>
								</div>
							);
						})}

						{filteredGestures.length === 0 && !loading && (
							<p className="col-span-full text-center text-gray-700 dark:text-gray-300 mt-6">
								No gestures found.
							</p>
						)}
					</div>
				)}
			</main>
		</div>
	);
}
