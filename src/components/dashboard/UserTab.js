"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { auth, db } from "../../utils/firebaseConfig";
import { createUserWithEmailAndPassword, updateEmail, updatePassword } from "firebase/auth";
import { collection, doc, setDoc, updateDoc, onSnapshot, deleteDoc, serverTimestamp } from "firebase/firestore";

const UsersTab = () => {
	const [users, setUsers] = useState([]);
	const [search, setSearch] = useState("");
	const [newUser, setNewUser] = useState({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
		confirmPassword: "",
		userType: "DHH",
	});
	const [editId, setEditId] = useState(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const usersCollection = collection(db, "users");

	// Real-time fetch users
	useEffect(() => {
		const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
			setUsers(
				snapshot.docs.map((doc) => {
					const data = doc.data();
					return {
						id: doc.id,
						firstName: data.firstName || "Unknown",
						lastName: data.lastName || "",
						name: data.name || `${data.firstName || "Unknown"} ${data.lastName || ""}`.trim(),
						email: data.email || "—",
						userType: data.userType || "Unknown",
					};
				})
			);
		});
		return () => unsubscribe();
	}, []);

	const openModal = (user = null) => {
		if (user) {
			setEditId(user.id);
			setNewUser({ ...user, password: "", confirmPassword: "" });
		} else {
			setEditId(null);
			setNewUser({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "", userType: "DHH" });
		}
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setEditId(null);
		setNewUser({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "", userType: "DHH" });
		setShowPassword(false);
		setShowConfirmPassword(false);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const fullName = `${newUser.firstName} ${newUser.lastName}`.trim();
		if (!newUser.firstName || !newUser.lastName || !newUser.email || (!editId && !newUser.password)) return;
		if (!editId && newUser.password !== newUser.confirmPassword) return;

		try {
			if (editId) {
				await updateDoc(doc(usersCollection, editId), {
					firstName: newUser.firstName,
					lastName: newUser.lastName,
					name: fullName,
					email: newUser.email,
					userType: newUser.userType,
				});

				const userAuth = auth.currentUser;
				if (userAuth && userAuth.uid === editId) {
					if (userAuth.email !== newUser.email) await updateEmail(userAuth, newUser.email);
					if (newUser.password) await updatePassword(userAuth, newUser.password);
				}
			} else {
				const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
				const userId = userCredential.user.uid;

				await setDoc(doc(usersCollection, userId), {
					firstName: newUser.firstName,
					lastName: newUser.lastName,
					name: fullName,
					email: newUser.email,
					userType: newUser.userType,
					createdAt: serverTimestamp(),
				});
			}

			closeModal();
		} catch (err) {
			console.error("Error saving user:", err);
			alert(err.message);
		}
	};

	const handleDeleteUser = async (id) => {
		if (!confirm("Are you sure you want to delete this user?")) return;
		try {
			await deleteDoc(doc(usersCollection, id));
		} catch (err) {
			console.error("Error deleting user:", err);
			alert(err.message);
		}
	};

	const filteredUsers = useMemo(
		() => users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())),
		[search, users]
	);

	return (
		<div className="min-h-screen p-6 font-sans">
			{/* Header */}
			<div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
				<h2 className="font-semibold text-gray-800 text-lg">User Management</h2>
				<div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
					<input
						type="text"
						placeholder="Search users..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="flex-1 border rounded-lg px-3 py-2 text-sm"
					/>
					<button onClick={() => openModal()} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">
						Create User
					</button>
				</div>
			</div>

			{/* Modal */}
			{isModalOpen && (
				<div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
					<div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md relative">
						<h3 className="font-semibold text-lg mb-4 text-center">
							{editId ? "Edit User" : "Create User"}
						</h3>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<input
									type="text"
									placeholder="First Name"
									value={newUser.firstName}
									onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
									className="w-full h-11 px-3 border rounded-lg"
									required
								/>
								<input
									type="text"
									placeholder="Last Name"
									value={newUser.lastName}
									onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
									className="w-full h-11 px-3 border rounded-lg"
									required
								/>
							</div>

							<input
								type="email"
								placeholder="Email"
								value={newUser.email}
								onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
								className="w-full h-11 px-3 border rounded-lg"
								required
								disabled={!!editId}
							/>

							<select
								value={newUser.userType}
								onChange={(e) => setNewUser({ ...newUser, userType: e.target.value })}
								className="w-full h-11 px-3 border rounded-lg"
							>
								<option value="DHH">DHH</option>
								<option value="Hearing">Hearing</option>
							</select>

							{!editId && (
								<>
									<div className="relative">
										<input
											type={showPassword ? "text" : "password"}
											placeholder="Password"
											value={newUser.password}
											onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
											className="w-full h-11 px-3 border rounded-lg pr-10"
											required
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className="absolute right-3 top-2 text-gray-500"
										>
											{showPassword ? <EyeOff /> : <Eye />}
										</button>
									</div>

									<div className="relative">
										<input
											type={showConfirmPassword ? "text" : "password"}
											placeholder="Confirm Password"
											value={newUser.confirmPassword}
											onChange={(e) =>
												setNewUser({ ...newUser, confirmPassword: e.target.value })
											}
											className="w-full h-11 px-3 border rounded-lg pr-10"
											required
										/>
										<button
											type="button"
											onClick={() => setShowConfirmPassword(!showConfirmPassword)}
											className="absolute right-3 top-2 text-gray-500"
										>
											{showConfirmPassword ? <EyeOff /> : <Eye />}
										</button>
									</div>
								</>
							)}

							<div className="flex gap-3 mt-2">
								<button type="submit" className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg">
									{editId ? "Update User" : "Create User"}
								</button>
								<button
									type="button"
									onClick={closeModal}
									className="flex-1 border px-4 py-2 rounded-lg"
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Users List */}
			<div className="space-y-4">
				{filteredUsers.map((u) => (
					<div
						key={u.id}
						className="bg-white rounded-2xl p-4 flex justify-between items-center border border-gray-200"
					>
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold shadow-md">
								{(u.name || "")
									.split(" ")
									.map((n) => n?.[0] || "")
									.join("")
									.toUpperCase() || "?"}
							</div>
							<div className="flex flex-col">
								<span className="font-semibold">{u.name || "Unnamed"}</span>
								<span className="text-sm text-gray-500">{u.email || "—"}</span>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => openModal(u)}
								className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm shadow hover:brightness-110"
							>
								Edit
							</button>
							<button
								onClick={() => handleDeleteUser(u.id)}
								className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm shadow hover:brightness-110"
							>
								Delete
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default UsersTab;
