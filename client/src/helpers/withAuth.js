import React, {useEffect} from "react";
import {useNavigate} from "react-router-dom";
import cookie from "cookie";

const withAuth = (Component) => {
    const AuthenticatedComponent = (props) => {
        const navigate = useNavigate();

        useEffect(() => {
            const cookies = cookie.parse(document.cookie);
            if (!cookies.token) {
                navigate("/signin");
            }
        }, [navigate]);

        return <Component {...props} />;
    };

    return AuthenticatedComponent;
};

export default withAuth;