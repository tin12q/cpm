import React, {useEffect} from "react";
import {useNavigate} from "react-router-dom";
import cookie from "cookie";

const signedIn = (Component) => {
    const AuthenticatedComponent = (props) => {
        const navigate = useNavigate();

        useEffect(() => {
            const cookies = cookie.parse(document.cookie);
            if (cookies.token) {
                navigate("/");
            } else return <Component {...props} />;
        }, [navigate]);

        return '';
    };

    return AuthenticatedComponent;
};

export default signedIn;