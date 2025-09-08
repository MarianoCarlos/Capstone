"use client";

export default function Home() {
	return (
		<main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-gray-900 font-sans">
			{/* Header / Navbar */}
			<header className="fixed top-0 left-0 w-full flex justify-between items-center px-8 py-4 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md shadow-md z-50">
				{/* Left: Logo + Brand */}
				<div className="flex items-center gap-4">
					<div className="w-12 h-12 bg-gray-900 dark:bg-gray-200 rounded-full flex items-center justify-center text-white dark:text-black font-bold shadow-md text-lg">
						ASL
					</div>
					<span className="text-2xl font-bold text-gray-800 dark:text-white tracking-wide">InSync</span>
				</div>

				{/* Right: Buttons */}
				<div className="flex gap-4">
					<a
						href="/login"
						className="px-5 py-2 bg-gray-900 dark:bg-gray-200 text-white dark:text-black font-medium rounded-full shadow hover:shadow-lg transition-transform hover:scale-105"
					>
						Login
					</a>
					<a
						href="/signup"
						className="px-5 py-2 border border-gray-900 dark:border-gray-200 text-gray-900 dark:text-gray-200 font-medium rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					>
						Sign Up
					</a>
				</div>
			</header>

			{/* Hero Section */}
			<section className="text-center max-w-3xl pt-32 mx-auto px-6">
				<h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tight leading-tight text-gray-900 dark:text-white">
					Learn & Translate <span className="text-gray-800 dark:text-gray-200">ASL</span> Seamlessly
				</h1>
				<p className="text-lg md:text-xl opacity-80 mb-10 max-w-2xl mx-auto text-gray-700 dark:text-gray-400">
					An interactive platform to{" "}
					<span className="font-semibold text-gray-800 dark:text-gray-200">
						translate, learn, and practice
					</span>{" "}
					American Sign Language — making communication more inclusive and accessible.
				</p>
				<div className="flex justify-center">
					<a
						href="/signup"
						className="px-8 py-4 bg-gray-900 dark:bg-gray-200 text-white dark:text-black font-semibold rounded-full shadow-lg hover:shadow-xl transition-transform hover:scale-110"
					>
						Get Started
					</a>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="mt-36 grid md:grid-cols-3 gap-10 max-w-6xl w-full px-6 mx-auto">
				{[
					{
						title: "⚡ Real-Time Translation",
						desc: "Translate ASL hand signs instantly with our AI-powered recognition engine.",
					},
					{
						title: "📚 Interactive Learning",
						desc: "Master ASL through guided lessons, practice activities, and real-time feedback.",
					},
					{
						title: "🌍 Accessible for All",
						desc: "Breaking barriers and promoting inclusivity with tools designed for everyone.",
					},
				].map((feature, i) => (
					<div
						key={i}
						className="p-8 rounded-3xl shadow-lg bg-white dark:bg-gray-800 backdrop-blur-md border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-transform hover:-translate-y-2"
					>
						<h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-200">
							{feature.title}
						</h2>
						<p className="opacity-80 text-gray-700 dark:text-gray-400">{feature.desc}</p>
					</div>
				))}
			</section>

			{/* Footer */}
			<footer className="mt-40 py-8 text-sm opacity-70 text-center border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
				<p>© {new Date().getFullYear()} InSync. All rights reserved.</p>
			</footer>
		</main>
	);
}
