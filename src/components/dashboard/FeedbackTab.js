"use client";

import React, { useState, useMemo } from "react";
import { Star } from "lucide-react"; // using lucide icons for consistent style

const FeedbackTab = ({ recentFeedback = [] }) => {
	const [selectedRating, setSelectedRating] = useState("all");
	const [selectedUserType, setSelectedUserType] = useState("all");

	const filteredFeedback = useMemo(() => {
		return recentFeedback.filter((f) => {
			const ratingMatch = selectedRating === "all" || f.rating === Number(selectedRating);
			const userTypeMatch = selectedUserType === "all" || f.userType === selectedUserType;
			return ratingMatch && userTypeMatch;
		});
	}, [recentFeedback, selectedRating, selectedUserType]);

	const averageRating = recentFeedback.length
		? (recentFeedback.reduce((acc, f) => acc + f.rating, 0) / recentFeedback.length).toFixed(1)
		: 0;
	const totalFeedback = recentFeedback.length;

	// Helper to render stars
	const renderStars = (rating) => {
		const stars = [];
		for (let i = 1; i <= 5; i++) {
			stars.push(
				<Star
					key={i}
					className={`w-4 h-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
				/>
			);
		}
		return <div className="flex gap-1">{stars}</div>;
	};

	if (!recentFeedback.length)
		return (
			<div className="bg-white p-6 rounded-xl shadow">
				<h2 className="text-xl font-semibold text-gray-900 mb-4">Feedback</h2>
				<p className="text-gray-500">No feedback available.</p>
			</div>
		);

	return (
		<div className="bg-white p-6 rounded-xl shadow-md">
			{/* Header & Stats */}
			<div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
				<h2 className="text-2xl font-bold text-gray-900">Feedback Overview</h2>

				<div className="flex gap-6">
					{/* Avg Rating Card */}
					<div className="flex flex-col items-center bg-gray-800 p-4 rounded-lg w-32 shadow-md">
						<div className="text-xl font-bold text-white flex items-center gap-1">
							{averageRating}
							<Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
						</div>
						<div className="text-gray-300 text-sm text-center">Avg. Rating</div>
					</div>

					{/* Total Feedback Card */}
					<div className="flex flex-col items-center bg-gray-800 p-4 rounded-lg w-32 shadow-md">
						<div className="text-xl font-bold text-white">{totalFeedback}</div>
						<div className="text-gray-300 text-sm text-center">Total Feedback</div>
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-4 items-center mb-6">
				<div className="flex items-center gap-2">
					<label className="font-medium text-gray-700">Rating:</label>
					<select
						value={selectedRating}
						onChange={(e) => setSelectedRating(e.target.value)}
						className="border border-gray-300 rounded-lg p-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
					>
						<option value="all">All</option>
						{[5, 4, 3, 2, 1].map((r) => (
							<option key={r} value={r}>
								{r} Stars
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2">
					<label className="font-medium text-gray-700">User Type:</label>
					<select
						value={selectedUserType}
						onChange={(e) => setSelectedUserType(e.target.value)}
						className="border border-gray-300 rounded-lg p-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
					>
						<option value="all">All</option>
						<option value="DHH">DHH</option>
						<option value="Hearing">Hearing</option>
					</select>
				</div>
			</div>

			{/* Feedback Cards */}
			<div className="space-y-4">
				{filteredFeedback.length ? (
					filteredFeedback.map((f) => (
						<div
							key={f.id}
							className="p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition"
						>
							<div className="flex justify-between items-center mb-2">
								<span className="font-semibold text-gray-900">{f.user}</span>
								{renderStars(f.rating)}
							</div>
							<p className="text-gray-700 mb-2">{f.comment}</p>
							<span className="text-sm text-gray-600 font-medium">{f.userType}</span>
						</div>
					))
				) : (
					<p className="text-gray-500 text-center">No feedback matching the filters.</p>
				)}
			</div>
		</div>
	);
};

export default FeedbackTab;
