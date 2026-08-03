import { BrowserRouter, Routes, Route, Link } from "react-router-dom"; 
import { ConnectButton } from "@rainbow-me/rainbowkit"; 
import Dashboard from "./pages/Dashboard"; 
import CreateEvent from "./pages/CreateEvent"; 
import EventDetail from "./pages/EventDetail"; 
import VerifyResults from "./pages/VerifyResults"; 

function App() { 
    return ( <BrowserRouter> 
    <header className="border-b border-border bg-surface"> 
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"> 
            <Link to="/" className="text-xl font-extrabold text-primary"> Devotify </Link> 
            <div className="flex items-center gap-3">
                <Link to="/verify" className="text-sm font-semibold text-primary hover:text-primary-bright">Verify results</Link>
                <ConnectButton /> 
            </div> 
        </div> 
    </header> 
    
    <main className="mx-auto max-w-5xl px-6 py-8"> 
        <Routes> 
            <Route path="/" element={<Dashboard />} /> 
            <Route path="/create" element={<CreateEvent />} /> 
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/verify" element={<VerifyResults />} />
             </Routes> </main> </BrowserRouter> ); 
} 

export default App;