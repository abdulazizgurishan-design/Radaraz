import dynamic from "next/dynamic";
const Radar = dynamic(() => import("../components/Radar"), { ssr: false });
export default function Home() { return <Radar />; }
