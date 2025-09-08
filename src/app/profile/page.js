"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth, db } from "../../utils/firebaseConfig";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Book, MessageSquare, User, Camera, Home, Eye, EyeOff } from "lucide-react";

export default function ProfilePage() {
	const [userInfo, setUserInfo] = useState({
		firstName: "",
		lastName: "",
		email: "",
		age: "",
		userType: "",
	});
	const [isEditing, setIsEditing] = useState(false);
	const [showPasswordForm, setShowPasswordForm] = useState(false);
	const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
	const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

	const pathname = usePathname();

	const navItems = [
		{ href: "/userdashboard", label: "Home", icon: <Home className="w-5 h-5" /> },
		{ href: "/translation", label: "Translation", icon: <Camera className="w-5 h-5" /> },
		{ href: "/gesturelibrary", label: "Gesture Library", icon: <Book className="w-5 h-5" /> },
		{ href: "/feedback", label: "Feedback", icon: <MessageSquare className="w-5 h-5" /> },
		{ href: "/profile", label: "Profile", icon: <User className="w-5 h-5" /> },
	];

	const getLinkClasses = (href) =>
		`flex items-center gap-2 px-3 py-2 rounded-lg transition font-medium ${
			pathname === href
				? "bg-gray-900 text-white dark:bg-gray-200 dark:text-black shadow-md font-bold"
				: "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
		}`;

	useEffect(() => {
		const fetchUserData = async () => {
			const user = auth.currentUser;
			if (!user) return;
			const userRef = doc(db, "users", user.uid);
			const userSnap = await getDoc(userRef);
			if (userSnap.exists()) {
				const data = userSnap.data();
				setUserInfo({
					firstName: data.firstName || "",
					lastName: data.lastName || "",
					email: data.email || "",
					age: data.age || "",
					userType: data.userType || "Dhh",
				});
			}
		};
		fetchUserData();
	}, []);

	const handleChange = (e) => setUserInfo({ ...userInfo, [e.target.name]: e.target.value });

	const handleSave = async () => {
		try {
			const user = auth.currentUser;
			if (!user) return;
			const userRef = doc(db, "users", user.uid);
			await updateDoc(userRef, {
				firstName: userInfo.firstName,
				lastName: userInfo.lastName,
				email: userInfo.email,
				age: userInfo.age,
				userType: userInfo.userType,
				updatedAt: new Date(),
			});
			setIsEditing(false);
			setShowPasswordForm(false);
			alert("Profile updated successfully!");
		} catch (error) {
			console.error(error);
			alert("Failed to update profile.");
		}
	};

	const handleChangePassword = async () => {
		const user = auth.currentUser;
		if (!user) return;
		if (passwords.new !== passwords.confirm) {
			alert("Passwords do not match!");
			return;
		}
		try {
			const credential = EmailAuthProvider.credential(user.email, passwords.current);
			await reauthenticateWithCredential(user, credential);
			await updatePassword(user, passwords.new);
			alert("Password changed successfully!");
			setPasswords({ current: "", new: "", confirm: "" });
			setShowPasswordForm(false);
		} catch (error) {
			console.error(error);
			alert("Failed to change password. Make sure your current password is correct.");
		}
	};

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
			<main className="flex-1 md:pl-64 flex justify-center items-start p-8">
				<div className="w-full max-w-3xl">
					<header className="text-center mb-10">
						<h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
							My Profile
						</h1>
						<p className="text-gray-700 dark:text-gray-400 opacity-80 max-w-2xl mx-auto">
							Update your information and customize your profile.
						</p>
					</header>

					<div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
						<div className="flex flex-col md:flex-row gap-8">
							{/* Avatar */}
							<div className="flex flex-col items-center">
								<div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300 text-4xl font-bold">
									{userInfo.firstName.charAt(0)}
								</div>
								<p className="mt-2 text-gray-700 dark:text-gray-300 text-center font-semibold">
									{userInfo.firstName} {userInfo.lastName}
								</p>
							</div>

							{/* Profile Info Form */}
							<div className="flex-1 w-full">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									{["firstName", "lastName", "email", "age"].map((field) => (
										<div key={field} className="flex flex-col">
											<label className="mb-1 text-gray-700 dark:text-gray-300 font-medium">
												{field === "firstName"
													? "First Name"
													: field === "lastName"
													? "Last Name"
													: field === "email"
													? "Email"
													: "Age"}
											</label>
											<input
												type={field === "age" ? "number" : "text"}
												name={field}
												value={userInfo[field]}
												onChange={handleChange}
												disabled={!isEditing}
												className="p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
											/>
										</div>
									))}

									<div className="flex flex-col">
										<label className="mb-1 text-gray-700 dark:text-gray-300 font-medium">
											User Type
										</label>
										<select
											name="userType"
											value={userInfo.userType}
											onChange={handleChange}
											disabled={!isEditing}
											className="p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
										>
											<option value="Dhh">Dhh</option>
											<option value="Hearing">Hearing</option>
										</select>
									</div>
								</div>

								{/* Buttons */}
								<div className="flex gap-4 mt-6 flex-wrap">
									<button
										onClick={() => {
											if (isEditing) handleSave();
											else setIsEditing(true);
											setShowPasswordForm(true);
										}}
										className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
											pathname === "/profile" || isEditing
												? "bg-gray-900 text-white dark:bg-gray-200 dark:text-black shadow-md font-bold"
												: "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
										}`}
									>
										{isEditing ? "Save Changes" : "Edit Profile"}
									</button>
								</div>

								{/* Change Password Form */}
								{isEditing && showPasswordForm && (
									<div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
										<h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
											Change Password
										</h2>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											{["current", "new", "confirm"].map((field) => (
												<div key={field} className="relative flex flex-col">
													<label className="mb-1 text-gray-700 dark:text-gray-300 font-medium">
														{field === "current"
															? "Current Password"
															: field === "new"
															? "New Password"
															: "Confirm New Password"}
													</label>
													<div className="relative flex items-center">
														<input
															type={showPasswords[field] ? "text" : "password"}
															name={field}
															value={passwords[field]}
															onChange={(e) =>
																setPasswords({ ...passwords, [field]: e.target.value })
															}
															disabled={!isEditing}
															className="w-full p-3 pr-10 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200"
														/>
														<button
															type="button"
															onClick={() =>
																setShowPasswords({
																	...showPasswords,
																	[field]: !showPasswords[field],
																})
															}
															className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 flex items-center justify-center"
														>
															{showPasswords[field] ? (
																<EyeOff className="w-5 h-5" />
															) : (
																<Eye className="w-5 h-5" />
															)}
														</button>
													</div>
												</div>
											))}
										</div>
										<div className="flex justify-end mt-6">
											<button
												onClick={handleChangePassword}
												className="flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium bg-gray-900 text-white dark:bg-gray-200 dark:text-black hover:opacity-90 shadow-md"
											>
												Change Password
											</button>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
