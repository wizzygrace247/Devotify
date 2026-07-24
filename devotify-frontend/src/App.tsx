import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Dashboard from "./pages/Dashboard";
import CreateEvent from "./pages/CreateEvent";
import EventDetail from "./pages/EventDetail";
function App() {

    
    return (<BrowserRouter>
    <header style={{ display: "flex", justifyContent: "flex-end", padding: "1rem" }}> <ConnectButton /> 
    
    </header>

     <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateEvent />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
    </Routes> </BrowserRouter>)
        ;
}

export default App;