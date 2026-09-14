export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    console.log("Foo");
    return new Response(`Requested URL: ${url.href}`, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  },
};
