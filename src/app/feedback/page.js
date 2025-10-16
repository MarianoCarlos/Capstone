"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Book, Camera, User, MessageSquare, History } from "lucide-react";

// Firebase
import { auth, db } from "@/utils/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function FeedbackPage() {
	const [feedbackText, setFeedbackText] = useState("");
	const [rating, setRating] = useState(0);
	const [hoverRating, setHoverRating] = useState(0);
	const [userName, setUserName] = useState("");

	const pathname = usePathname();
	const ratingLabels = ["Terrible", "Poor", "Average", "Good", "Excellent"];

	// Listen for authenticated user
	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user) setUserName(user.displayName || user.email);
			else setUserName("");
		});
		return () => unsubscribe();
	}, []);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!feedbackText || rating === 0) return alert("Please provide feedback and a rating!");

		try {
			await addDoc(collection(db, "feedback"), {
				user: userName || "Anonymous",
				comment: feedbackText,
				rating,
				createdAt: serverTimestamp(),
				status: "new",
			});

			setFeedbackText("");
			setRating(0);
			setHoverRating(0);
			alert("Thank you for your feedback!");
		} catch (err) {
			console.error("Error submitting feedback:", err);
			alert("Failed to submit feedback. Please try again.");
		}
	};

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
				<header className="text-center mb-10">
					<h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
						Feedback
					</h1>
					<p className="text-gray-700 dark:text-gray-400 opacity-80 max-w-2xl mx-auto">
						Rate our platform and share your feedback to help us improve.
					</p>
				</header>

				{/* Feedback Form */}
				<div className="max-w-3xl mx-auto bg-white/90 dark:bg-gray-900/80 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
					<h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Submit Feedback</h2>
					<form onSubmit={handleSubmit} className="flex flex-col gap-6">
						{/* Star Rating */}
						<div className="flex flex-col items-center">
							<div className="flex items-center gap-2">
								{[1, 2, 3, 4, 5].map((star) => (
									<button
										key={star}
										type="button"
										onClick={() => setRating(star)}
										onMouseEnter={() => setHoverRating(star)}
										onMouseLeave={() => setHoverRating(0)}
										className={`text-4xl transition-colors duration-200 transform ${
											(hoverRating || rating) >= star
												? "text-yellow-400 scale-125"
												: "text-gray-300 dark:text-gray-500"
										}`}
									>
										★
									</button>
								))}
							</div>
							<p className="mt-2 text-gray-700 dark:text-gray-300 font-medium">
								{hoverRating
									? ratingLabels[hoverRating - 1]
									: rating
									? ratingLabels[rating - 1]
									: "Select a rating"}
							</p>
						</div>

						{/* Feedback Textarea */}
						<textarea
							value={feedbackText}
							onChange={(e) => setFeedbackText(e.target.value)}
							placeholder="Write your feedback here..."
							className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200 resize-none h-32"
						/>

						<button
							type="submit"
							className="w-1/3 mx-auto px-6 py-3 bg-gray-900 dark:bg-gray-200 text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition"
						>
							Submit
						</button>
					</form>
				</div>
			</main>
		</div>
	);
}
