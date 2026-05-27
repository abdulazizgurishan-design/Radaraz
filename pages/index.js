export default function Home() {
  return null;
}

export async function getServerSideProps(context) {
  context.res.writeHead(302, { Location: '/landing.html' });
  context.res.end();
  return { props: {} };
}
