import React from 'react';
import { Link } from 'react-router-dom';
import "../styles/NotFound.css";

const NotFound: React.FC = () => {

  return (
    <div className="notfound-container">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>
        Oops! The page you are looking for doesn't exist, has been removed, or is temporarily unavailable.
      </p>
      <Link to="/">Home</Link>
    </div>
  );
};

export default NotFound;
