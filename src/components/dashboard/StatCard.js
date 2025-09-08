"use client";

import React from "react";

const StatCard = ({ title = "", value = 0, growth = "" }) => {
	return (
		<div className="bg-white shadow rounded-xl p-6 border border-gray-200">
			<p className="text-sm text-gray-500">{title}</p>
			<p className="text-2xl font-bold text-gray-900">
				{typeof value === "number" ? value.toLocaleString() : value}
			</p>
			{growth && <p className="text-xs text-green-600">{growth}</p>}
		</div>
	);
};

export default StatCard;
