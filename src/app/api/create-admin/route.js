import admin from "firebase-admin";
import serviceAccount from "../../../../backend/serviceAccountKey.json"; // relative to route.js

if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
	});
}

export async function POST(req) {
	try {
		const { email, password } = await req.json();

		const userRecord = await admin.auth().createUser({
			email,
			password,
		});

		// Mark as admin
		await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

		return new Response(JSON.stringify({ success: true, uid: userRecord.uid }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err) {
		console.error("Error creating admin:", err.message);
		return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
