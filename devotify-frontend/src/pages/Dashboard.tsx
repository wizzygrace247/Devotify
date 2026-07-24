import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface VotingEvent {
    event_id: number;
    topic: string;
    creator: string;
    registration_deadline: number;
    voting_deadline: number;
    results_revealed: boolean;
}
function Dashboard() {
    const [events, setEvents] = useState<VotingEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://127.0.0.1:8000/events").then((res) => res.json()).then((data) => {
            setEvents(data.events);
            setLoading(false);
        })
        .catch((err) => {
            console.error("Failed to fetch events:", err);
            setLoading(false);
        });
    }, []);

    if (loading) return <p>Loading events...</p>;
    return (<div> <h1>Devotify</h1> <Link to="/create">+ Create Election</Link> <ul>
        {events.map((event) => (<li key={event.event_id}> <Link to={`/events/${event.event_id}`}>
         {event.topic} {event.results_revealed ? "(Results revealed)" : ""} </Link>
         </li>))} 
         </ul> 
         </div>);
}

export default Dashboard;