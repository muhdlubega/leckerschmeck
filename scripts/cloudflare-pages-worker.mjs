import application from "./index.js";

const worker = {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/_next/")) {
      url.pathname = `/__assets${url.pathname}`;
      return env.ASSETS.fetch(new Request(url, request));
    }

    return application.fetch(request, env, context);
  },
};

export default worker;
