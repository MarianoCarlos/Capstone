"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Firebase imports
import { auth } from "../../utils/firebaseConfig";
import { signInWithEmailAndPassword, getIdTokenResult } from "firebase/auth";

export default function LoginPage() {
	const router = useRouter();
	const [mounted, setMounted] = useState(false);
	const [formData, setFormData] = useState({ email: "", password: "" });
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		setMounted(true); // Only render after client hydration
	}, []);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData({ ...formData, [name]: value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			// 1️⃣ Sign in with Firebase
			const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);

			const user = userCredential.user;

			// 2️⃣ Get ID token and custom claims
			const idTokenResult = await getIdTokenResult(user);

			if (idTokenResult.claims.admin) {
				// 3️⃣ Admin → redirect to admin dashboard
				router.push("/admindashboard");
			} else {
				// 4️⃣ Regular user → redirect to user dashboard
				router.push("/userdashboard");
			}
		} catch (err) {
			console.error(err);

			// Firebase error handling
			if (err.code === "auth/user-not-found") {
				setError("No account found with this email.");
			} else if (err.code === "auth/wrong-password") {
				setError("Incorrect password. Please try again.");
			} else if (err.code === "auth/invalid-email") {
				setError("Please enter a valid email address.");
			} else {
				setError("Failed to log in. Please try again.");
			}
		} finally {
			setLoading(false);
		}
	};

	if (!mounted) return null; // Prevent SSR mismatch

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-gray-900 px-4 font-sans">
			<div className="w-full max-w-md bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-3xl shadow-xl p-8 relative font-sans">
				<Link
					href="/"
					className="absolute top-4 left-4 flex items-center gap-2 h-11 px-4 rounded-full bg-gray-900 dark:bg-gray-200 text-white dark:text-black shadow-md hover:shadow-lg transition-transform hover:scale-105 text-sm font-semibold"
				>
					<ArrowLeft className="w-4 h-4" />
					Home
				</Link>

				<div className="flex flex-col items-center mb-6 mt-6">
					<img src="/logo.png" alt="App Logo" className="w-20 h-20 mb-3" />
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">InSync</h1>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">Email</label>
						<input
							name="email"
							type="email"
							value={formData.email}
							onChange={handleChange}
							required
							placeholder="you@example.com"
							className="w-full h-11 px-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
						/>
					</div>

					<div className="relative">
						<label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">
							Password
						</label>
						<input
							name="password"
							type={showPassword ? "text" : "password"}
							value={formData.password}
							onChange={handleChange}
							required
							placeholder="********"
							className="w-full h-11 px-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 outline-none pr-10 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
						/>
						<button
							type="button"
							onClick={() => setShowPassword(!showPassword)}
							className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center"
						>
							{showPassword ? (
								<EyeOff className="w-5 h-5 text-gray-500" />
							) : (
								<Eye className="w-5 h-5 text-gray-500" />
							)}
						</button>

						<Link
							href="/forgot-password"
							className="block mt-2 text-sm font-semibold text-gray-900 dark:text-white text-right hover:underline transition-colors"
						>
							Forgot Password?
						</Link>
					</div>

					{error && <p className="text-red-500 text-sm">{error}</p>}

					<button
						type="submit"
						disabled={loading}
						className="w-full h-11 bg-gray-900 dark:bg-gray-200 text-white dark:text-black font-bold rounded-md shadow-md hover:shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
					>
						{loading ? "Logging in..." : "Log In"} <ArrowRight className="w-5 h-5" />
					</button>
				</form>

				<p className="text-center text-sm mt-4">
					Don't have an account?{" "}
					<Link href="/signup" className="text-gray-900 dark:text-white font-semibold hover:underline">
						Sign Up
					</Link>
				</p>
			</div>
		</div>
	);
}
