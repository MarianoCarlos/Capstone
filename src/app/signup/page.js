"use client";

import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Firebase imports
import { auth, db } from "../../utils/firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function SignupPage() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		firstName: "",
		lastName: "",
		email: "",
		userType: "DHH", // consistent field name
		password: "",
		confirmPassword: "",
	});
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData({ ...formData, [name]: value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setLoading(true);

		try {
			// Create Firebase user
			const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
			const user = userCredential.user;

			// Update display name
			await updateProfile(user, {
				displayName: `${formData.firstName} ${formData.lastName}`,
			});

			// Store user data in Firestore without status
			await setDoc(doc(db, "users", user.uid), {
				firstName: formData.firstName,
				lastName: formData.lastName,
				name: `${formData.firstName} ${formData.lastName}`,
				email: formData.email,
				userType: formData.userType, // consistent field
				createdAt: new Date(),
			});

			// Redirect to dashboard
			router.push("/userdashboard");
		} catch (err) {
			console.error(err);
			if (err.code === "auth/email-already-in-use") {
				setError("This email is already registered. Please log in.");
			} else if (err.code === "auth/invalid-email") {
				setError("Please enter a valid email address.");
			} else if (err.code === "auth/weak-password") {
				setError("Password should be at least 6 characters.");
			} else {
				setError("Failed to sign up. Please try again.");
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-gray-900 px-4 font-sans">
			<div className="w-full max-w-md bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-3xl shadow-xl p-8 relative">
				<Link
					href="/"
					className="absolute top-4 left-4 flex items-center gap-2 h-11 px-4 rounded-full bg-gray-900 dark:bg-gray-200 text-white dark:text-black shadow-md hover:shadow-lg transition-transform hover:scale-105 text-sm font-semibold font-sans"
				>
					<ArrowLeft className="w-4 h-4" /> Home
				</Link>

				<div className="flex flex-col items-center mb-6 mt-6">
					<img src="/logo.png" alt="App Logo" className="w-20 h-20 mb-3" />
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">InSync</h1>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">
								First Name
							</label>
							<input
								name="firstName"
								type="text"
								value={formData.firstName}
								onChange={handleChange}
								required
								placeholder="John"
								className="w-full h-11 px-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">
								Last Name
							</label>
							<input
								name="lastName"
								type="text"
								value={formData.lastName}
								onChange={handleChange}
								required
								placeholder="Doe"
								className="w-full h-11 px-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
							/>
						</div>
					</div>

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

					<div>
						<label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">
							User Type
						</label>
						<select
							name="userType"
							value={formData.userType}
							onChange={handleChange}
							className="w-full h-11 px-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
						>
							<option value="DHH">DHH</option>
							<option value="Hearing">Hearing</option>
						</select>
					</div>

					<div className="relative">
						<label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">
							Password
						</label>
						<div className="relative flex items-center">
							<input
								name="password"
								type={showPassword ? "text" : "password"}
								value={formData.password}
								onChange={handleChange}
								required
								placeholder="********"
								className="w-full h-11 px-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white pr-10"
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-3 flex items-center justify-center h-6 w-6 text-gray-500"
							>
								{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
							</button>
						</div>
					</div>

					<div className="relative">
						<label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">
							Confirm Password
						</label>
						<div className="relative flex items-center">
							<input
								name="confirmPassword"
								type={showConfirmPassword ? "text" : "password"}
								value={formData.confirmPassword}
								onChange={handleChange}
								required
								placeholder="********"
								className="w-full h-11 px-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white pr-10"
							/>
							<button
								type="button"
								onClick={() => setShowConfirmPassword(!showConfirmPassword)}
								className="absolute right-3 flex items-center justify-center h-6 w-6 text-gray-500"
							>
								{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
							</button>
						</div>
					</div>

					{error && <p className="text-red-500 text-sm">{error}</p>}

					<button
						type="submit"
						disabled={loading}
						className="w-full h-11 bg-gray-900 dark:bg-gray-200 text-white dark:text-black font-bold rounded-md shadow-md hover:shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
					>
						{loading ? "Signing Up..." : "Sign Up"}
						<ArrowRight className="w-5 h-5" />
					</button>
				</form>

				<p className="text-center text-sm text-gray-700 dark:text-gray-400 mt-4">
					Already have an account?{" "}
					<Link href="/login" className="font-semibold text-gray-900 dark:text-gray-200 hover:underline">
						Log In
					</Link>
				</p>
			</div>
		</div>
	);
}
