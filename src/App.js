import { useCallback, useEffect, useState } from "react";
import { Footer, TabBar, TopBar, useTheme } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import { fetchProperties } from "./lib/api";
import { link, useRoute } from "./lib/router";
import { useSeo } from "./lib/seo";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Property from "./pages/Property";
import Review from "./pages/Review";
import { About, Privacy } from "./pages/About";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Admin from "./pages/Admin";

// Titles and descriptions search engines show for each page.
const PAGES = {
  home: {
    title: "Hindsight | Unfiltered UK rental reviews",
    description: "Check a rental before you sign. Previous tenants score damp, heating, the landlord, deposits and 17 more things the listing never shows.",
    path: "/",
  },
  search: {
    title: "Search rental reviews by postcode | Hindsight",
    description: "Search UK homes reviewed by the tenants who lived there, by postcode, street or town, or on the map.",
    path: "/search",
  },
  review: {
    title: "Review a home you rented | Hindsight",
    description: "Moved out? Review the home you rented in about five minutes and help the next tenant avoid nasty surprises.",
    path: "/review",
  },
  about: {
    title: "About Hindsight | Unfiltered UK rental reviews",
    description: "Hindsight is a free, independent site where UK tenants review the homes they rented after moving out.",
    path: "/about",
  },
  privacy: { title: "Privacy and complaints | Hindsight", description: "What Hindsight collects, why, and how to complain about a review.", path: "/privacy" },
  terms: { title: "Terms of use | Hindsight", description: "The rules for reading, writing and replying to reviews on Hindsight.", path: "/terms" },
  contact: { title: "Contact | Hindsight", description: "Questions, data requests or complaints about Hindsight.", path: "/contact" },
};

function NotFound() {
  useSeo({ title: "Page not found | Hindsight", noindex: true });
  return (
    <main className="page"><div className="wrap flow">
      <div className="panel empty">
        <h3>That page does not exist</h3>
        <p>The link may be out of date. Search for the home instead.</p>
        <a className="btn btn-primary" href={link("/search")}>Search homes</a>
      </div>
    </div></main>
  );
}

function PageSeo({ name }) {
  useSeo(PAGES[name]);
  return null;
}

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

  let page;
  switch (route.name) {
    case "home": page = <Home {...data} />; break;
    case "search": page = <Search key={route.path} {...data} route={route} />; break;
    case "property": page = <Property key={route.id} id={route.id} />; break;
    case "review": page = <Review route={route} onPublished={load} />; break;
    case "about": page = <About />; break;
    case "privacy": page = <Privacy />; break;
    case "terms": page = <Terms />; break;
    case "contact": page = <Contact />; break;
    case "admin": page = <Admin />; break;
    default: page = <NotFound />;
  }

  return (
    <ToastProvider>
      {PAGES[route.name] && <PageSeo name={route.name} />}
      <TopBar route={route} theme={theme} setTheme={setTheme} />
      {page}
      <Footer />
      <TabBar route={route} />
    </ToastProvider>
  );
}
