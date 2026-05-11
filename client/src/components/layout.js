const Layout = ({ children, className = "" }) => {
  return <main className={`app-view ${className}`.trim()}>{children}</main>;
};

export default Layout;
