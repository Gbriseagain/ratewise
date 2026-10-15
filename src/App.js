import { useCallback, useEffect, useState } from "react";
import { Footer, TabBar, TopBar, useTheme } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import { fetchProperties } from "./lib/api";
import { useRoute } from "./lib/router";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Property from "./pages/Property";
import Review from "./pages/Review";
import { About, Privacy } from "./pages/About";

const TITLES = {
  home: "Hindsight | Unfiltered UK rental reviews",
  search: "Search homes | Hindsight",
  review: "Leave a review | Hindsight",
  about: "About | Hindsight",
  privacy: "Privacy and complaints | Hindsight",
  property: "Tenant reviews | Hindsight",
};

export default function App() {
  const route = useRoute();
  const [theme, setTheme] = useTheme();
  const [data, setData] = useState({ properties: [], loading: true, error: null });

  const load = useCallback(() => {
    fetchProperties()
      .then((properties) => setData({ properties, loading: false, error: null }))
      .catch((e) => setData({ properties: [], loading: false, error: e.message }));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = TITLES[route.name] || TITLES.home; }, [route.name]);

  let page;
  switch (route.name) {
    case "search": page = <Search key={route.path} {...data} route={route} />; break;
    case "property": page = <Property key={route.id} id={route.id} />; break;
    case "review": page = <Review route={route} onPublished={load} />; break;
    case "about": page = <About />; break;
    case "privacy": page = <Privacy />; break;
    default: page = <Home {...data} />;
  }

  return (
    <ToastProvider>
      <TopBar route={route} theme={theme} setTheme={setTheme} />
      {page}
      <Footer />
      <TabBar route={route} />
    </ToastProvider>
  );
}
