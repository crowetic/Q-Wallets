import {
  AppBar,
  Box,
  ButtonBase,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListSubheader,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useEffect, useMemo, useContext, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import walletContext, { IContextProps } from './contexts/walletContext';
import { useAuth } from 'qapp-core';
import qort from './assets/qort.png';
import btc from './assets/btc.png';
import ltc from './assets/ltc.png';
import doge from './assets/doge.png';
import dgb from './assets/dgb.png';
import rvn from './assets/rvn.png';
import arrr from './assets/arrr.png';
import { SiMonero } from 'react-icons/si';
import qWalletsLogo from './assets/q-wallets-logo.webp';
import { useIframe } from './hooks/useIframeListener';
import { useTranslation } from 'react-i18next';
import packageJson from '../package.json';
import { EMPTY_STRING, TIME_MINUTES_1 } from './common/constants';
import MenuIcon from '@mui/icons-material/Menu';
import { syncAllAddressBooksOnStartup } from './utils/addressBookQDN';
import {
  ADDRESS_BOOK_STORAGE_EVENT,
  setAddressBookAccountScope,
} from './utils/addressBookStorage';
import changelogContent from '../CHANGELOG.md?raw';
import Markdown from 'react-markdown';
import CloseIcon from '@mui/icons-material/Close';

type SceneGlowLayerKey = 'primaryCyan' | 'topBlue' | 'stars' | 'vignette';

type SceneGlowLayerSettings = {
  blur: number;
  intensity: number;
  spread: number;
  x: number;
  y: number;
};

type SceneGlowSettings = Record<SceneGlowLayerKey, SceneGlowLayerSettings>;

const isChangelogAssetPath = (path?: string) =>
  typeof path === 'string' &&
  (path.startsWith('/changelog/') || path.startsWith('changelog/'));

const getRuntimeBasePath = () => {
  const basePath = window._qdnBase || import.meta.env.BASE_URL || '';

  if (!basePath || basePath === '/') return '';
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
};

const toChangelogAssetSrc = (path?: string) => {
  if (!path) return '';
  if (!isChangelogAssetPath(path)) return path;

  return `${getRuntimeBasePath()}${path.replace(/^\/+/, '')}`;
};

const DEFAULT_SCENE_GLOW_SETTINGS: SceneGlowSettings = {
  primaryCyan: { blur: 0, intensity: 99, spread: 81, x: 90, y: -61 },
  topBlue: { blur: 0, intensity: 100, spread: 100, x: 0, y: 0 },
  stars: { blur: 0, intensity: 96, spread: 85, x: 12, y: -11 },
  vignette: { blur: 0, intensity: 100, spread: 100, x: 0, y: 0 },
};

const sceneLayerTransform = (layer: SceneGlowLayerSettings) =>
  `translate(${layer.x}px, ${layer.y}px) scale(${layer.spread / 100})`;

const sceneGlowLayerSx = (
  layer: SceneGlowLayerSettings,
  sx: {
    background: string;
    height: string;
    left: string;
    opacity: number;
    top: string;
    width: string;
  }
) => ({
  background: sx.background,
  filter: `blur(${layer.blur}px)`,
  height: sx.height,
  left: sx.left,
  opacity: sx.opacity * (layer.intensity / 100),
  pointerEvents: 'none',
  position: 'absolute' as const,
  top: sx.top,
  transform: sceneLayerTransform(layer),
  transformOrigin: 'center',
  width: sx.width,
});

function SceneAtmosphere({ settings }: { settings: SceneGlowSettings }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        inset: 0,
        minHeight: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        width: '100%',
        zIndex: 0,
      }}
    >
      <Box
        sx={sceneGlowLayerSx(settings.primaryCyan, {
          background:
            'radial-gradient(ellipse at center, rgba(24,189,242,0.18) 0%, rgba(24,189,242,0.065) 42%, transparent 76%)',
          height: '55vh',
          left: '-10vw',
          opacity: 1,
          top: '-4vh',
          width: '62vw',
        })}
      />
      <Box
        sx={sceneGlowLayerSx(settings.topBlue, {
          background:
            'radial-gradient(ellipse at center, rgba(42,117,217,0.12) 0%, rgba(42,117,217,0.045) 42%, transparent 72%)',
          height: '34vh',
          left: '20vw',
          opacity: 1,
          top: '-10vh',
          width: '58vw',
        })}
      />
      <Box
        sx={{
          backgroundImage:
            'radial-gradient(circle at 12% 20%, rgba(24,189,242,0.36) 0 1px, transparent 1.7px), radial-gradient(circle at 62% 8%, rgba(74,179,255,0.26) 0 1px, transparent 1.8px), radial-gradient(circle at 39% 34%, rgba(180,226,255,0.18) 0 1px, transparent 1.6px)',
          backgroundPosition: '0 0, 80px 30px, 140px 70px',
          backgroundSize: '310px 220px, 420px 280px, 520px 360px',
          filter: `blur(${settings.stars.blur}px)`,
          inset: 0,
          opacity: 0.28 * (settings.stars.intensity / 100),
          pointerEvents: 'none',
          position: 'absolute',
          transform: sceneLayerTransform(settings.stars),
          transformOrigin: 'center',
        }}
      />
      <Box
        sx={sceneGlowLayerSx(settings.vignette, {
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.16) 100%)',
          height: '100%',
          left: '0',
          opacity: 1,
          top: '0',
          width: '100%',
        })}
      />
    </Box>
  );
}

export default function AppLayout() {
  useIframe();

  const { t } = useTranslation(['core']);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { setWalletState } = useContext(walletContext);
  const { address, avatarUrl, name } = useAuth();
  setAddressBookAccountScope(address || null);
  const [isUsingGateway, setIsUsingGateway] = useState(true);
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogPreviewImage, setChangelogPreviewImage] = useState<{
    alt: string;
    src: string;
  } | null>(null);

  // derive selected from the URL
  const selectedSegment = useMemo(() => {
    const seg = location.pathname.replace(/^\//, EMPTY_STRING);
    return seg || '/';
  }, [location.pathname]);

  async function getNodeInfo() {
    try {
      const nodeInfo = await qortalRequest({
        action: 'GET_NODE_INFO',
      });
      const nodeStatus = await qortalRequest({
        action: 'GET_NODE_STATUS',
      });
      return { ...nodeInfo, ...nodeStatus };
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    let isMounted = true;

    const fetchGatewayStatus = async () => {
      try {
        const res = await qortalRequest({
          action: 'IS_USING_PUBLIC_NODE',
        });
        if (isMounted) {
          setIsUsingGateway(res);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchGatewayStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let nodeInfoTimeoutId: number | NodeJS.Timeout;
    (async () => {
      nodeInfoTimeoutId = setInterval(async () => {
        const infos = await getNodeInfo();
        setNodeInfo(infos);
      }, TIME_MINUTES_1);
      const infos = await getNodeInfo();
      setNodeInfo(infos);
    })();
    return () => {
      clearInterval(nodeInfoTimeoutId);
    };
  }, []);

  useEffect(() => {
    const session: IContextProps = {
      address: address ?? EMPTY_STRING,
      avatar: avatarUrl ?? EMPTY_STRING,
      name: name ?? EMPTY_STRING,
      isAuthenticated: !!address,
      isUsingGateway: isUsingGateway,
      nodeInfo: nodeInfo,
    };
    if (setWalletState) {
      setWalletState(session);
    } else {
      console.error('setWalletState is not available in wallet context');
    }
  }, [address, avatarUrl, isUsingGateway, name, nodeInfo, setWalletState]);

  useEffect(() => {
    window.dispatchEvent(new Event(ADDRESS_BOOK_STORAGE_EVENT));
  }, [address]);

  // Sync address books from QDN on app startup
  useEffect(() => {
    // Only sync if user is authenticated
    if (address && name) {
      syncAllAddressBooksOnStartup(name)
        .catch((err) => {
          console.error('Failed to sync address books on startup:', err);
          // App continues to work with localStorage only
        })
        .finally(() => {
          window.dispatchEvent(new Event(ADDRESS_BOOK_STORAGE_EVENT));
        });
    }
  }, [address, name]);

  type NavHeader = { kind: 'header'; title: string };
  type NavSegment = { segment: string; title: string; icon: React.ReactNode };
  type Navigation = Array<NavHeader | NavSegment>;

  const coinStyle = { width: 24, height: 'auto' } as const;

  const NAVIGATION: Navigation = [
    {
      kind: 'header',
      title: t('core:wallets', { postProcess: 'capitalizeAll' }),
    },
    {
      segment: 'qortal',
      title: t('core:coins.qortal', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={qort} style={coinStyle} />,
    },
    {
      segment: 'bitcoin',
      title: t('core:coins.bitcoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={btc} style={coinStyle} />,
    },
    {
      segment: 'litecoin',
      title: t('core:coins.litecoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={ltc} style={coinStyle} />,
    },
    {
      segment: 'dogecoin',
      title: t('core:coins.dogecoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={doge} style={coinStyle} />,
    },
    {
      segment: 'digibyte',
      title: t('core:coins.digibyte', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={dgb} style={coinStyle} />,
    },
    {
      segment: 'ravencoin',
      title: t('core:coins.ravencoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={rvn} style={coinStyle} />,
    },
    {
      segment: 'piratechain',
      title: t('core:coins.piratechain', {
        postProcess: 'capitalizeFirstChar',
      }),
      icon: <img src={arrr} style={coinStyle} />,
    },
  ];

  NAVIGATION.push({
    segment: 'monero',
    title: 'Monero',
    icon: <SiMonero size={24} color="#f26822" />,
  });

  const navItems = NAVIGATION.filter(
    (i): i is NavSegment => (i as any).segment
  );
  const coinLabels: Record<string, string> = {
    qortal: 'QORT',
    litecoin: 'LTC',
    bitcoin: 'BTC',
    dogecoin: 'DOGE',
    digibyte: 'DGB',
    ravencoin: 'RVN',
    piratechain: 'ARRR',
    monero: 'XMR',
  };
  const activeNavItem =
    navItems.find(
      (item) =>
        selectedSegment === item.segment ||
        (selectedSegment === '/' && item.segment === '/')
    ) ?? navItems[0];

  const drawerWidth = 280;

  const drawerSx = {
    width: drawerWidth,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
      p: 1.5,
      width: drawerWidth,
    },
  } as const;

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleNavigate = (segment: string) => {
    navigate(segment === '/' ? '/' : `/${segment}`);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawerContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
    >
      <List
        disablePadding
        subheader={
          <ListSubheader
            component="div"
            sx={{
              bgcolor: 'transparent',
              color: 'text.secondary',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              lineHeight: 1.2,
              px: 1,
              py: 1.5,
              textTransform: 'uppercase',
            }}
          >
            {t('core:wallets', { postProcess: 'capitalizeAll' })}
          </ListSubheader>
        }
        sx={{ flexGrow: 1 }}
      >
        {navItems.map((item) => {
          const isSelected =
            selectedSegment === item.segment ||
            (selectedSegment === '/' && item.segment === '/');
          return (
            <ListItem key={item.segment} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigate(item.segment)}
                selected={isSelected}
                sx={{
                  borderRadius: 1.5,
                  minHeight: 48,
                  px: 1,
                  py: 1,
                  '&.Mui-selected': (theme: Theme) => ({
                    bgcolor: theme.palette.action.selected,
                    color: theme.palette.primary.main,
                    fontWeight: 700,
                  }),
                }}
              >
                <ListItemIcon
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    minWidth: 0,
                    width: '100%',
                  }}
                >
                  <Box sx={{ width: 24, height: 24, display: 'inline-flex' }}>
                    {item.icon}
                  </Box>
                  <Box
                    sx={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </Box>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ mt: 'auto', mb: 1, textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={{ fontSize: 10, color: 'text.secondary' }}
        >
          v{packageJson.version}
        </Typography>
        <br />
        <Link
          component="button"
          variant="caption"
          onClick={() => setChangelogOpen(true)}
          sx={{ fontSize: 9, cursor: 'pointer' }}
        >
          CHANGELOG
        </Link>
      </Box>
    </Box>
  );

  const desktopNavigation = (
    <Box
      sx={{
        alignItems: 'center',
        display: { xs: 'none', md: 'block' },
        mb: 0.75,
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          gap: 1.5,
          justifyContent: 'space-between',
          minHeight: 50,
          px: 1.5,
        }}
      >
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            gap: 1,
            flex: { md: '0 1 96px', lg: '0 0 184px' },
            minWidth: 0,
          }}
        >
          <Box
            component="img"
            alt="Q-Wallets"
            src={qWalletsLogo}
            sx={{
              filter: 'drop-shadow(0 0 12px rgba(24,189,242,0.26))',
              height: 32,
              width: 32,
            }}
          />
          <Typography
            sx={{
              display: { md: 'none', lg: 'block' },
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            Q-Wallets
          </Typography>
          <Link
            component="button"
            variant="caption"
            onClick={() => setChangelogOpen(true)}
            sx={{
              bgcolor: 'rgba(255,255,255,0.055)',
              border: (t) =>
                `1px solid ${
                  t.palette.mode === 'dark'
                    ? 'rgba(116,158,180,0.16)'
                    : 'rgba(17,24,39,0.08)'
                }`,
              borderRadius: 999,
              color: 'text.secondary',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1,
              px: 1,
              py: 0.5,
              textDecoration: 'none',
            }}
          >
            v{packageJson.version}
          </Link>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 auto',
            flexWrap: 'nowrap',
            gap: 0,
            justifyContent: 'center',
            minWidth: 0,
          }}
        >
          {navItems.map((item, index) => {
            const isSelected =
              selectedSegment === item.segment ||
              (selectedSegment === '/' && item.segment === '/');
            return (
              <Box
                key={item.segment}
                sx={{
                  alignItems: 'center',
                  display: 'inline-flex',
                }}
              >
                <ButtonBase
                  onClick={() => handleNavigate(item.segment)}
                  sx={{
                    alignItems: 'center',
                    border: '1px solid transparent',
                    borderRadius: 1,
                    color: isSelected ? 'text.primary' : 'text.secondary',
                    display: 'inline-flex',
                    gap: 0.75,
                    minHeight: 42,
                    minWidth: { md: 44, lg: 74 },
                    overflow: 'hidden',
                    px: { md: 0.8, lg: 1.2 },
                    py: 0.75,
                    position: 'relative',
                    bgcolor: isSelected
                      ? 'rgba(24, 189, 242, 0.1)'
                      : 'transparent',
                    '&:hover': {
                      bgcolor: isSelected
                        ? 'rgba(24, 189, 242, 0.16)'
                        : 'rgba(255,255,255,0.035)',
                      color: 'text.primary',
                    },
                  }}
                >
                  <Box sx={{ display: 'inline-flex', height: 22, width: 22 }}>
                    {item.icon}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: { md: 'none', lg: 'block' },
                      fontWeight: isSelected ? 700 : 600,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {coinLabels[item.segment] ?? item.title}
                  </Typography>
                </ButtonBase>
                {index < navItems.length - 1 && (
                  <Box
                    sx={{
                      borderLeft: '1px solid rgba(116,158,180,0.22)',
                      height: 28,
                      mx: { md: 0.45, lg: 0.7 },
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            minWidth: 54,
          }}
        >
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        bgcolor: (t) => (t.palette.mode === 'dark' ? '#030b14' : '#f4f8fb'),
        backgroundImage: (t) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #020917 0%, #061421 48%, #030b14 100%)'
            : 'radial-gradient(circle at 12% 0%, rgba(11,143,211,0.13), transparent 30%), radial-gradient(circle at 84% 8%, rgba(242,184,75,0.1), transparent 28%), linear-gradient(180deg, #f8fbfd 0%, #eef5f8 52%, #f7fafc 100%)',
        isolation: 'isolate',
        minHeight: '100dvh',
        overflowX: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Box
        sx={{
          opacity: (t) => (t.palette.mode === 'dark' ? 1 : 0.28),
          pointerEvents: 'none',
        }}
      >
        <SceneAtmosphere settings={DEFAULT_SCENE_GLOW_SETTINGS} />
      </Box>
      {isMobile && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            color: 'text.primary',
            zIndex: (t: Theme) => t.zIndex.drawer + 1,
          }}
        >
          <Toolbar sx={{ minHeight: 56, px: 1.5 }}>
            <IconButton
              color="primary"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'inline-flex', height: 26, mr: 1, width: 26 }}>
              {activeNavItem?.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                component="div"
                noWrap
                sx={{ fontWeight: 700 }}
              >
                {activeNavItem?.title}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontWeight: 600 }}
              >
                {t('core:wallets', { postProcess: 'capitalizeAll' })}
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={drawerSx}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          overflowX: 'hidden',
          px: { xs: 1.5, sm: 2, md: 3, lg: 4 },
          py: { xs: 2, md: 1.5 },
          position: 'relative',
          width: '100%',
          zIndex: 1,
        }}
      >
        <Container
          maxWidth={false}
          disableGutters
          sx={{ maxWidth: 1660, mx: 'auto' }}
        >
          {desktopNavigation}
          <Outlet />
        </Container>
      </Box>

      <Dialog
        disableScrollLock
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { maxHeight: '80vh' } } }}
      >
        <DialogTitle sx={{ textAlign: 'center', position: 'relative' }}>
          {t('core:app.changelog')}
          <IconButton
            aria-label={t('core:app.close_changelog')}
            onClick={() => setChangelogOpen(false)}
            size="small"
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ scrollbarGutter: 'stable' }}>
          <Box
            sx={{
              '& h1': { fontSize: '1.5rem', fontWeight: 600, mb: 2, mt: 0 },
              '& h2': {
                fontSize: '1.2rem',
                fontWeight: 600,
                mb: 1,
                mt: 3,
                color: 'primary.main',
              },
              '& h3': { fontSize: '1rem', fontWeight: 600, mb: 1, mt: 2 },
              '& ul': { pl: 2, mb: 1 },
              '& li': { mb: 0.5, fontSize: 14 },
              '& p': { mb: 1, fontSize: 14 },
              '& p:has(img)': {
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.25,
                mb: 1.5,
                mt: 1,
              },
              '& code': {
                backgroundColor: 'action.hover',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: 13,
              },
            }}
          >
            <Markdown
              components={{
                a: ({ href, children }: any) => {
                  const isChangelogImage = isChangelogAssetPath(href);

                  if (!isChangelogImage) {
                    return (
                      <Link href={href} target="_blank" rel="noreferrer">
                        {children}
                      </Link>
                    );
                  }

                  const alt = href.includes('before')
                    ? t('core:app.q_wallets_before_redesign')
                    : t('core:app.q_wallets_after_redesign');
                  const src = toChangelogAssetSrc(href);

                  return (
                    <ButtonBase
                      aria-label={t('core:app.open_image_preview', { alt })}
                      onClick={() =>
                        setChangelogPreviewImage({
                          alt,
                          src,
                        })
                      }
                      sx={{
                        borderRadius: 1,
                        display: 'block',
                        overflow: 'hidden',
                        width: { xs: 'calc(50% - 5px)', sm: 168 },
                        '&:focus-visible': {
                          outline: '1px solid rgba(24,189,242,0.65)',
                          outlineOffset: 2,
                        },
                      }}
                    >
                      {children}
                    </ButtonBase>
                  );
                },
                img: ({ src, alt }: any) => (
                  <Box
                    component="img"
                    alt={alt || ''}
                    src={toChangelogAssetSrc(src)}
                    sx={{
                      border: (t) => `1px solid ${t.palette.divider}`,
                      borderRadius: 1,
                      display: 'block',
                      height: { xs: 74, sm: 90 },
                      objectFit: 'cover',
                      width: '100%',
                    }}
                  />
                ),
              }}
            >
              {changelogContent}
            </Markdown>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog
        disableScrollLock
        maxWidth="lg"
        fullWidth
        open={Boolean(changelogPreviewImage)}
        onClose={() => setChangelogPreviewImage(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(3, 17, 29, 0.985)',
              border: '1px solid rgba(91,132,158,0.28)',
              borderRadius: 2,
              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogTitle sx={{ pr: 6 }}>
          {changelogPreviewImage?.alt}
          <IconButton
            aria-label={t('core:app.close_image_preview')}
            onClick={() => setChangelogPreviewImage(null)}
            size="small"
            sx={{
              position: 'absolute',
              right: 12,
              top: 12,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '0 !important' }}>
          {changelogPreviewImage ? (
            <Box
              component="img"
              alt={changelogPreviewImage.alt}
              src={changelogPreviewImage.src}
              sx={{
                borderRadius: 1,
                display: 'block',
                maxHeight: '72vh',
                objectFit: 'contain',
                width: '100%',
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
