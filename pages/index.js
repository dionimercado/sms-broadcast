import Head from "next/head";

export default function Home({ isConnected }) {
  return (
    <div className="container">
      <Head>
        <title>Unauthorized</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 className="title">Unauthorized!</h1>
      </main>
    </div>
  );
}
