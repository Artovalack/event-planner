import React from 'react';

const HomePage = () => {
    return (
        <div className="home-container">
            <h1>Welcome to the Event Planner</h1>
            <p>Your one-stop solution for planning and managing events.</p>
            <a href="/login" className="btn">Login</a>
            <a href="/signup" className="btn">Sign Up</a>
        </div>
    );
};

export default HomePage;