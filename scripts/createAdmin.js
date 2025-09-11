import fetch from "node-fetch";

async function createAdmin() {
	try {
		const res = await fetch("http://localhost:3000/api/create-admin", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "admin@example.com",
				password: "StrongPassword123",
			}),
		});

		const data = await res.json();
		console.log("Admin created:", data);
	} catch (err) {
		console.error("Error creating admin:", err);
	}
}

createAdmin();
