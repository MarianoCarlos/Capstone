"use client";

import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Firebase
import { db } from "@/utils/firebaseConfig";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

ChartJS.register(ArcElement, Tooltip, Legend);

const OverviewTab = () => {
	const [recentUsers, setRecentUsers] = useState([]);
	const [recentFeedback, setRecentFeedback] = useState([]);
	const [feedbackStats, setFeedbackStats] = useState({
		averageRating: 0,
		newFeedback: 0,
	});

	// Fetch recent users
	useEffect(() => {
		const usersRef = collection(db, "users");
		const q = query(usersRef, orderBy("createdAt", "desc"), limit(10));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const users = snapshot.docs
				.map((doc) => {
					const data = doc.data();
					return {
						id: doc.id,
						name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unnamed",
						type: data.userType || "Unknown",
						joined: "Just now",
					};
				})
				// ✅ only keep DHH and Hearing
				.filter((u) => u.type === "DHH" || u.type === "Hearing");

			setRecentUsers(users);
		});

		return () => unsubscribe();
	}, []);

	// Fetch recent feedback
	useEffect(() => {
		const feedbackRef = collection(db, "feedback");
		const q = query(feedbackRef, orderBy("createdAt", "desc"), limit(10));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const feedback = snapshot.docs.map((doc) => {
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
			setRecentFeedback(feedback);

			// Update feedback stats (avg + new only)
			if (feedback.length) {
				const avg = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
				const newCount = feedback.filter((f) => f.status === "new").length;
				setFeedbackStats({
					averageRating: avg.toFixed(1),
					newFeedback: newCount,
				});
			}
		});

		return () => unsubscribe();
	}, []);

	// Prepare pie chart data (only DHH + Hearing)
	const userTypeCounts = recentUsers.reduce((acc, user) => {
		if (user.type === "DHH" || user.type === "Hearing") {
			acc[user.type] = (acc[user.type] || 0) + 1;
		}
		return acc;
	}, {});

	const pieData = {
		labels: Object.keys(userTypeCounts),
		datasets: [
			{
				data: Object.values(userTypeCounts),
				backgroundColor: ["#4f46e5", "#f97316"], // DHH: Indigo, Hearing: Orange
				hoverBackgroundColor: ["#6366f1", "#fb923c"],
			},
		],
	};

	return (
		<div className="grid lg:grid-cols-3 gap-6">
			{/* Left Column */}
			<div className="lg:col-span-2 space-y-6">
				{/* Recent Users */}
				<div className=" rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
					<div className="px-6 py-4 border-b border-gray-100">
						<h2 className="font-semibold text-xl text-gray-900">Recent Users</h2>
					</div>
					<div className="p-4 max-h-[400px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
						{recentUsers.length ? (
							recentUsers.map((u) => (
								<div
									key={u.id}
									className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl shadow-sm hover:shadow-md transition"
								>
									<div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow bg-gray-800">
										{u.name
											.split(" ")
											.map((n) => n[0])
											.join("")
											.toUpperCase()}
									</div>
									<div>
										<p className="font-medium text-gray-900">{u.name}</p>
										<p className="text-sm text-gray-500">{u.type}</p>
									</div>
								</div>
							))
						) : (
							<p className="text-gray-500 text-center">No users found.</p>
						)}
					</div>
				</div>

				{/* Recent Feedback */}
				<div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
					<div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
						<h2 className="font-semibold text-xl text-gray-900">Recent Feedback</h2>
						<div className="flex gap-4 text-sm text-gray-500">
							<span>Avg: {feedbackStats.averageRating || 0} ★</span>
							<span>New: {feedbackStats.newFeedback || 0}</span>
						</div>
					</div>
					<div className="p-4 max-h-[400px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
						{recentFeedback.length ? (
							recentFeedback.map((f) => (
								<div
									key={f.id}
									className="p-4 bg-gray-50 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col gap-2"
								>
									<div className="flex justify-between items-center">
										<p className="font-medium text-gray-900">{f.user}</p>
										<span className="text-xs text-gray-400">{f.time}</span>
									</div>
									<p className="text-sm text-gray-600">{f.comment}</p>
									<div className="flex items-center gap-1">
										{Array.from({ length: 5 }).map((_, i) => (
											<span
												key={i}
												className={`text-sm ${
													i < f.rating ? "text-yellow-400" : "text-gray-300"
												}`}
											>
												★
											</span>
										))}
									</div>
								</div>
							))
						) : (
							<p className="text-gray-500 text-center">No feedback found.</p>
						)}
					</div>
				</div>
			</div>

			{/* Right Column Pie Chart */}
			<div className="space-y-6">
				<div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6 flex flex-col items-center">
					<h2 className="font-semibold text-lg text-gray-900 mb-4">User Type Distribution</h2>
					<div className="w-56 h-56">
						<Pie data={pieData} />
					</div>
				</div>
			</div>
		</div>
	);
};

export default OverviewTab;
