import React from "react";

const Layout = (Component) => {
    return (
        <div className="grid grid-cols-2 gap-5 justify-items-center overflow-auto mt-20">
            {Component}
        </div>
    )
}
export default Layout;