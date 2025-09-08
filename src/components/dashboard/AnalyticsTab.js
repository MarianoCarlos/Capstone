"use client";
import React, { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Firebase
import { db } from "@/utils/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";

function AnalyticsDashboard() {
	const [userGrowth, setUserGrowth] = useState([]);
	const [ageData, setAgeData] = useState([]);
	const [disabilityTypes, setDisabilityTypes] = useState([]);

	useEffect(() => {
		const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
			const users = snapshot.docs.map((doc) => doc.data());

			// --- User Growth by Month ---
			const growthMap = {};
			users.forEach((user) => {
				if (user.createdAt?.seconds) {
					const date = new Date(user.createdAt.seconds * 1000);
					const month = date.toLocaleString("default", { month: "short" });
					growthMap[month] = (growthMap[month] || 0) + 1;
				}
			});
			const growthData = Object.keys(growthMap).map((month) => ({
				month,
				users: growthMap[month],
			}));
			setUserGrowth(growthData);

			// --- Exact Ages ---
			const ageCount = {};
			users.forEach((u) => {
				const age = parseInt(u.age);
				if (!isNaN(age)) {
					ageCount[age] = (ageCount[age] || 0) + 1;
				}
			});
			const ageArray = Object.keys(ageCount)
				.sort((a, b) => Number(a) - Number(b))
				.map((age) => ({
					age,
					count: ageCount[age],
				}));
			setAgeData(ageArray);

			// --- Disability Types ---
			const typeMap = { DHH: 0, Hearing: 0 };
			users.forEach((u) => {
				if (u.userType === "DHH") typeMap.DHH++;
				if (u.userType === "Hearing") typeMap.Hearing++;
			});
			setDisabilityTypes([
				{ name: "DHH", value: typeMap.DHH, color: "#4F46E5" }, // Indigo
				{ name: "Hearing", value: typeMap.Hearing, color: "#F97316" }, // Orange
			]);
		});

		return () => unsub();
	}, []);

	return (
		<div className="p-6 bg-gray-50 min-h-screen font-sans">
			<div className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* User Growth */}
					<div className="bg-white shadow rounded-xl p-6 hover:shadow-lg transition">
						<h3 className="text-gray-800 font-medium text-base mb-4">User Growth</h3>
						<ResponsiveContainer width="100%" height={250}>
							<LineChart data={userGrowth}>
								<XAxis dataKey="month" axisLine={false} tickLine={false} />
								<YAxis axisLine={false} tickLine={false} />
								<Tooltip />
								<Line type="monotone" dataKey="users" stroke="#22C55E" strokeWidth={3} dot={false} />
							</LineChart>
						</ResponsiveContainer>
					</div>

					{/* Users by Exact Age */}
					<div className="bg-white shadow rounded-xl p-6 hover:shadow-lg transition">
						<h3 className="text-gray-800 font-medium text-base mb-4">Users by Exact Age</h3>
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={ageData}>
								<XAxis dataKey="age" axisLine={false} tickLine={false} />
								<YAxis axisLine={false} tickLine={false} />
								<Tooltip />
								<Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#22C55E" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					{/* Disability Types */}
					<div className="bg-white shadow rounded-xl p-6 hover:shadow-lg transition col-span-1 md:col-span-2">
						<h3 className="text-gray-800 font-medium text-base mb-4">Users by Disability Type</h3>
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={disabilityTypes}>
								<XAxis dataKey="name" axisLine={false} tickLine={false} />
								<YAxis axisLine={false} tickLine={false} />
								<Tooltip />
								<Bar dataKey="value" radius={[6, 6, 0, 0]}>
									{disabilityTypes.map((entry, index) => (
										<Cell key={`cell-${index}`} fill={entry.color} />
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>

						<div className="flex items-center gap-6 mt-5">
							<div className="flex items-center gap-2">
								<span className="w-3.5 h-3.5 bg-indigo-600 rounded"></span>
								<span className="text-sm text-gray-600">DHH</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="w-3.5 h-3.5 bg-orange-500 rounded"></span>
								<span className="text-sm text-gray-600">Hearing</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default AnalyticsDashboard;
