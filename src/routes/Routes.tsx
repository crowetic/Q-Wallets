import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppWrapper } from '../AppWrapper';
import QortalWallet from '../pages/qort';
import LitecoinWallet from '../pages/ltc';
import BitcoinWallet from '../pages/btc';
import DogecoinWallet from '../pages/doge';
import DigibyteWallet from '../pages/dgb';
import RavencoinWallet from '../pages/rvn';
import PirateWallet from '../pages/arrr';
import MoneroWallet from '../pages/xmr';
import { EMPTY_STRING } from '../common/constants';

interface CustomWindow extends Window {
  _qdnBase: string;
}
const customWindow = window as unknown as CustomWindow;
const baseUrl = customWindow?._qdnBase || EMPTY_STRING;

export function Routes() {
  const router = createBrowserRouter(
    [
      {
        path: '/',
        element: <AppWrapper />,
        children: [
          { index: true, element: <QortalWallet /> },
          { path: 'qortal', element: <QortalWallet /> },
          { path: 'litecoin', element: <LitecoinWallet /> },
          { path: 'bitcoin', element: <BitcoinWallet /> },
          { path: 'dogecoin', element: <DogecoinWallet /> },
          { path: 'digibyte', element: <DigibyteWallet /> },
          { path: 'ravencoin', element: <RavencoinWallet /> },
          { path: 'piratechain', element: <PirateWallet /> },
          { path: 'monero', element: <MoneroWallet /> },
        ],
      },
    ],
    {
      basename: baseUrl,
    }
  );

  return <RouterProvider router={router} />;
}
