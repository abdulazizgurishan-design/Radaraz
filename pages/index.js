export default function Home() {}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/landing.html',
      permanent: false,
    },
  };
}
