import { promises as fs } from "fs";
import path from "path";

export async function GET() {
	try {
		// Read all files from the public/assets directory
		const assetsPath = path.join(process.cwd(), "public/assets");
		const files = await fs.readdir(assetsPath);

		// Filter for .jpg files and create gesture objects
		const gestures = files
			.filter((file) => file.endsWith(".jpg"))
			.map((file) => {
				const title = file.replace(".jpg", ""); // Remove .jpg extension
				// Categorize based on simple naming patterns or default to "words"
				let category = "words";
				if (title.length === 1) {
					category = "letters";
				} else if (!isNaN(title)) {
					category = "numbers";
				}

				return {
					id: title.replace(/\s+/g, "-").toLowerCase(),
					title: title,
					category: category,
					src: `/assets/${file}`,
				};
			})
			.sort((a, b) => a.title.localeCompare(b.title));

		return Response.json(gestures);
	} catch (error) {
		console.error("Error reading assets:", error);
		return Response.json({ error: "Failed to load gestures" }, { status: 500 });
	}
}
