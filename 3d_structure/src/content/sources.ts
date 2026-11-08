import type { MuseumSource } from './types'

export const sources = [
  {
    id: 'm4-cutaway',
    title: 'M4A4 cutaway drawing',
    organization: 'Wikimedia Commons / U.S. Government',
    url: 'https://commons.wikimedia.org/wiki/File:M4A4_cutaway.png',
    licenseNote:
      'Public-domain historical reference; the model is an educational reconstruction.',
  },
  {
    id: 'smithsonian-open',
    title: 'Smithsonian Open Access',
    organization: 'Smithsonian Institution',
    url: 'https://www.si.edu/openaccess/faq',
    licenseNote:
      'Open-access guidance and a reference route for future 3D assets.',
  },
  {
    id: 'nasa-3d',
    title: 'NASA 3D Resources',
    organization: 'NASA',
    url: 'https://science.nasa.gov/3d-resources/',
    licenseNote:
      'Aircraft research reference; NASA media and identity rules require review before reuse.',
  },
  {
    id: 'maritime-cc0',
    title: 'Scottish Maritime Museum CC0 collection',
    organization: 'Scottish Maritime Museum',
    url: 'https://sketchfab.com/ScottishMaritimeMuseum/collections/scottish-maritime-museum-cc0-b367fa03fcea40279a5470eea7872709',
    licenseNote:
      'CC0 research route; individual assets still require a source and rights audit.',
  },
  {
    id: 'tank-museum-m4a1',
    title: 'Sherman M4A1 (76) W',
    organization: 'The Tank Museum',
    url: 'https://tankmuseum.org/article/latest-from-the-museums-youtube-channel-november/',
    licenseNote:
      'Historical fact verification only; no museum media is reused. The museum identifies the M4A1 variant as using a Continental radial engine.',
  },
  {
    id: 'nasa-x57-project',
    title: 'X-57 Maxwell',
    organization: 'NASA',
    url: 'https://www.nasa.gov/x-57-maxwell/',
    licenseNote:
      'Primary project summary used for project status and ground-research context; no NASA media is embedded.',
  },
  {
    id: 'nasa-x57-overview',
    title: 'X-57 Maxwell Overview',
    organization: 'NASA Armstrong Flight Research Center',
    url: 'https://www.nasa.gov/centers-and-facilities/armstrong/x-57-maxwell/',
    licenseNote:
      'Primary overview used for the modification sequence, high-aspect-ratio wing and distributed-propulsion design intent.',
  },
  {
    id: 'ntrs-x57-modiv-performance',
    title: 'Flight Performance Maneuver Planning for the NASA X-57 Maxwell',
    organization: 'NASA Technical Reports Server',
    url: 'https://ntrs.nasa.gov/citations/20240007594',
    licenseNote:
      'Primary NASA technical paper used to distinguish the planned Mod IV configuration from configurations that actually flew.',
  },
  {
    id: 'ntrs-x57-power',
    title: 'X-57 Traction Power and Command Systems Development',
    organization: 'NASA Technical Reports Server',
    url: 'https://ntrs.nasa.gov/citations/20240009560',
    licenseNote:
      'Primary NASA technical paper used for the two-channel battery, power-distribution and motor-controller lessons.',
  },
  {
    id: 'ntrs-x57-cockpit',
    title: 'X-57 Cockpit Display System Development and Features',
    organization: 'NASA Technical Reports Server',
    url: 'https://ntrs.nasa.gov/citations/20230005312',
    licenseNote:
      'Primary NASA technical paper used for monitoring, instrumentation and controller thermal-management lessons.',
  },
  {
    id: 'scottish-maritime-asr10',
    title: 'Air–Sea Rescue Craft (ASR-10)',
    organization: 'Scottish Maritime Museum',
    url: 'https://www.scottishmaritimemuseum.org/3d_collections/air-sea-rescue-craft-asr-10/',
    licenseNote:
      'Historical fact reference for the wartime emergency shelter, supplies, radio call and fast rescue craft; no museum media is reused, and the teaching vessel is original project geometry.',
  },
  {
    id: 'noaa-boat-buoyancy',
    title: 'Boat Building Challenge',
    organization: 'NOAA Ocean Service',
    url: 'https://oceanservice.noaa.gov/education/dyw-boat-building.html',
    licenseNote:
      'Primary public education source used for displacement and buoyancy concepts.',
  },
  {
    id: 'imo-damage-stability',
    title: 'Damage Stability',
    organization: 'International Maritime Organization',
    url: 'https://www.imo.org/en/ourwork/safety/pages/damagestability.aspx',
    licenseNote:
      'Primary maritime-safety source used for the high-level watertight-subdivision lesson; no design calculations are reproduced.',
  },
  {
    id: 'rnli-brede-lifeboat',
    title: 'The Brede: Prototype of a New Lifeboat Based on the Lochin 33',
    organization: 'Royal National Lifeboat Institution',
    url: 'https://lifeboatmagazinearchive.rnli.org/volume/47/472/the-brede-prototype-of-a-new-lifeboat-based-on-the-lochin-33',
    licenseNote:
      'Primary RNLI archive article used for general modern lifeboat compartment, propulsion and survivor-space principles; it does not describe ASR-10.',
  },
  {
    id: 'rnli-sims-bridge',
    title: 'SIMS technology: what is it and how does it keep RNLI crew safe?',
    organization: 'Royal National Lifeboat Institution',
    url: 'https://rnli.org/magazine/magazine-featured-list/2014/october/sims-technology-that-puts-crew-safety-first',
    licenseNote:
      'Primary RNLI source used for the general monitoring relationship among navigation, engines, bilge and electrical systems.',
  },
  {
    id: 'nps-m1903-history',
    title: 'The 1903 Springfield Rifle',
    organization: 'National Park Service, Springfield Armory',
    url: 'https://www.nps.gov/spar/learn/historyculture/the-1903-springfield-rifle.htm',
    licenseNote:
      'Official historical reference used only for factual context; no external media is reused.',
  },
  {
    id: 'nps-m1903-production',
    title: 'U.S. Springfield Model 1903 Production',
    organization: 'National Park Service, Springfield Armory',
    url: 'https://www.nps.gov/spar/learn/historyculture/u-s-springfield-model-1903-production.htm',
    licenseNote:
      'Official production-history reference used only for factual context; no external media is reused.',
  },
  {
    id: 'smithsonian-m1911a1',
    title: 'Colt Model 1911A1 Semiautomatic Pistol',
    organization: 'Smithsonian National Museum of American History',
    url: 'https://americanhistory.si.edu/collections/object/nmah_415704',
    licenseNote:
      'Official collection record used only to identify the historical object; no external media is reused.',
  },
  {
    id: 'army-browning-m1911',
    title: 'Arming the Army: John M. Browning',
    organization: 'United States Army',
    url: 'https://www.army.mil/article/15705/arming_the_army_john_m_browning',
    licenseNote:
      'Official historical overview used only for contextual facts; no external media is reused.',
  },
  {
    id: 'army-firearm-systems',
    title: 'Perseverance Pays Off',
    organization: 'U.S. Army Acquisition Support Center',
    url: 'https://asc.army.mil/web/news-perseverance-pays-off/',
    licenseNote:
      'Official institutional history used only for high-level systems context; no external media is reused.',
  },
  {
    id: 'nps-springfield-ww2',
    title: 'Springfield Armory in World War II',
    organization: 'National Park Service',
    url: 'https://www.nps.gov/articles/springfieldarmoryww2.htm',
    licenseNote:
      'Official wartime-production history used only for factual context; no external media is reused.',
  },
  {
    id: 'nps-m1-variations',
    title: 'M1 Variations',
    organization: 'National Park Service, Springfield Armory',
    url: 'https://www.nps.gov/spar/learn/historyculture/m1-variations.htm',
    licenseNote:
      'Official variation history used only to bound the teaching profile; no external media is reused.',
  },
  {
    id: 'smithsonian-m1',
    title: 'U.S. Rifle M1 Garand',
    organization: 'Smithsonian National Museum of American History',
    url: 'https://www.americanhistory.si.edu/collections/object/nmah_418516',
    licenseNote:
      'Official collection record used only to identify the historical object; no external media is reused.',
  },
  {
    id: 'hk-mp5-official',
    title: 'MP5',
    organization: 'Heckler & Koch',
    url: 'https://www.heckler-koch.com/en/Products/Military%20and%20Law%20Enforcement/Submachine%20guns/MP5',
    licenseNote:
      'Manufacturer product-history reference used only for the standard profile; no external media is reused.',
  },
  {
    id: 'hk-roller-delay-history',
    title: 'Heckler & Koch Launches the SP5',
    organization: 'Heckler & Koch USA',
    url: 'https://hk-usa.com/2019/12/03/heckler-koch-launches-the-new-sp5/',
    licenseNote:
      'Manufacturer history used only for a high-level roller-delay explanation; no external media is reused.',
  },
] as const satisfies readonly MuseumSource[]
