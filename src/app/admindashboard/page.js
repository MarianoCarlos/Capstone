"use client";

import React, { useState, useEffect } from "react";
import StatCard from "@/components/dashboard/StatCard";
import OverviewTab from "@/components/dashboard/OverviewTab";
import UsersTab from "@/components/dashboard/UserTab";
import AnalyticsTab from "@/components/dashboard/AnalyticsTab";
import FeedbackTab from "@/components/dashboard/FeedbackTab";
import { LogOut } from "lucide-react";

// Firebase
import { auth, db } from "@/utils/firebaseConfig";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

const AdminDashboard = () => {
	const [activeTab, setActiveTab] = useState("overview");
	const [adminName, setAdminName] = useState("");

	const [recentUsers, setRecentUsers] = useState([]);
	const [recentFeedback, setRecentFeedback] = useState([]);
	const [systemStats, setSystemStats] = useState({
		totalUsers: 0,
		activeUsers: 0,
		dailyTranslations: 0,
	});
	const [feedbackStats, setFeedbackStats] = useState({
		averageRating: 0,
		newFeedback: 0,
		pendingReview: 0,
	});

	// Listen for auth state
	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user) {
				setAdminName(user.displayName || user.email);
			} else {
				setAdminName("");
			}
		});
		return () => unsubscribe();
	}, []);

	// Real-time users
	useEffect(() => {
		const usersRef = collection(db, "users");
		const usersQuery = query(usersRef, orderBy("joinedAt", "desc"), limit(5));

		const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
			const usersData = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					...data,
					joined: data.joinedAt ? new Date(data.joinedAt.seconds * 1000).toLocaleString() : "Just now",
				};
			});
			setRecentUsers(usersData);

			// Update system stats
			const totalUsers = snapshot.size;
			const activeUsers = usersData.filter((u) => u.status === "active").length;
			const dailyTranslations = 0; // Replace with your translations count if needed
			setSystemStats({ totalUsers, activeUsers, dailyTranslations });
		});

		return () => unsubscribe();
	}, []);

	// Real-time feedback
	useEffect(() => {
		const feedbackRef = collection(db, "feedback");
		const feedbackQuery = query(feedbackRef, orderBy("createdAt", "desc"), limit(5));

		const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
			const feedbackData = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					user: data.user || "Anonymous",
					comment: data.comment || "",
					rating: data.rating || 0,
					status: data.status || "new",
					time: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : "Just now",
				};
			});
			setRecentFeedback(feedbackData);

			// Update feedback stats
			const ratings = feedbackData.map((f) => f.rating);
			const averageRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
			const newFeedback = feedbackData.filter((f) => f.status === "new").length;
			const pendingReview = feedbackData.filter((f) => f.status === "pending").length;

			setFeedbackStats({ averageRating, newFeedback, pendingReview });
		});

		return () => unsubscribe();
	}, []);

	// Logout handler
	const handleLogout = async () => {
		await signOut(auth);
		window.location.href = "/login";
	};

	return (
		<div className="min-h-screen flex bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-gray-900 font-sans">
			{/* Sidebar */}
			<aside className="w-64 bg-white/90 dark:bg-gray-900/80 shadow-md p-6 hidden md:flex flex-col">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Admin</h2>
				<nav className="flex flex-col gap-3 flex-1">
					{["overview", "users", "analytics", "feedback"].map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={`flex items-center gap-2 px-3 py-2 rounded-lg transition font-medium ${
								activeTab === tab
									? "bg-gray-900 text-white dark:bg-gray-200 dark:text-black shadow-md font-bold"
									: "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
							}`}
						>
							{tab.charAt(0).toUpperCase() + tab.slice(1)}
						</button>
					))}
				</nav>
				<button onClick={handleLogout} className="flex items-center gap-2 mt-6 text-red-500 hover:text-red-600">
					<LogOut className="w-5 h-5" /> Logout
				</button>
			</aside>

			{/* Main Content */}
			<main className="flex-1 p-8">
				<header className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {adminName}!</h1>
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-red-500"
					>
						<LogOut className="w-5 h-5" /> Logout
					</button>
				</header>

				{/* Stats Section */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
					<StatCard title="Total Users" value={systemStats.totalUsers} growth="+12% this month" />
					<StatCard title="Active Users" value={systemStats.activeUsers} growth="+8% today" />
					<StatCard
						title="Daily Translations"
						value={systemStats.dailyTranslations}
						growth="+15% vs yesterday"
					/>
				</div>

				{/* Tab Content */}
				<div className="bg-white/90 dark:bg-gray-900/80 shadow-md rounded-3xl p-6 border border-gray-200 dark:border-gray-700">
					{activeTab === "overview" && (
						<OverviewTab
							recentUsers={recentUsers}
							recentFeedback={recentFeedback}
							feedbackStats={feedbackStats}
						/>
					)}
					{activeTab === "users" && <UsersTab recentUsers={recentUsers} />}
					{activeTab === "analytics" && <AnalyticsTab />}
					{activeTab === "feedback" && <FeedbackTab recentFeedback={recentFeedback} />}
				</div>
			</main>
		</div>
	);
};

export default AdminDashboard;
