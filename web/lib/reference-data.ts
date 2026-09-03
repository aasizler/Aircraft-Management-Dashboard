// Reference databases lifted verbatim from aerotrack_v1_07_3_6.html so the
// type / airport / engine autocompletes behave exactly as they did in v1.

/**
 * Powerplant class. Drives the inspection set an aircraft is seeded with and
 * whether an hours-based oil interval means anything — a piston runs a 50-hour
 * oil change and a 100-hour inspection; a turbine does neither. Absent means
 * piston, which is what every untagged row below is.
 */
export type AcClass = "piston" | "turboprop" | "jet";

export type AcType = { icao: string; mfr: string; model: string; desc?: string; cls?: AcClass };
export type Engine = { id: string; mfr: string; model: string; hp: number; tbo: number; type: string; app: string };

/**
 * `hp` holds thrust in pounds for turbofans — the field was named for the
 * piston rows it was first filled with. Printing "1846hp" next to a Vision Jet
 * is wrong in a way an owner will notice, so format through this.
 */
export const enginePower = (e: Engine) =>
  e.type === "Turbofan" ? `${e.hp.toLocaleString()} lbf` : `${e.hp} hp`;

export const AIRCRAFT_DB: AcType[] = [
  // Beechcraft / Textron
  {icao:'BE33',mfr:'Beechcraft',model:'Debonair / Bonanza 33',desc:'BE33 · Retractable, 225-285hp'},
  {icao:'BE35',mfr:'Beechcraft',model:'Bonanza V-tail (35 series)',desc:'BE35 · V-tail variants A35–V35'},
  {icao:'BE36',mfr:'Beechcraft',model:'Bonanza A36 / G36',desc:'BE36 · Straight tail, 285-300hp'},
  {icao:'BE58',mfr:'Beechcraft',model:'Baron 58',desc:'BE58 · Twin, 300hp × 2'},
  {icao:'BE55',mfr:'Beechcraft',model:'Baron 55',desc:'BE55 · Twin, 260hp × 2'},
  {icao:'BE76',mfr:'Beechcraft',model:'Duchess 76',desc:'BE76 · Twin trainer, 180hp × 2'},
  {icao:'BE23',mfr:'Beechcraft',model:'Musketeer / Sundowner',desc:'BE23 · Fixed gear, 150-180hp'},
  {icao:'BE24',mfr:'Beechcraft',model:'Sierra',desc:'BE24 · Retractable Musketeer'},
  {icao:'BE60',mfr:'Beechcraft',model:'Duke',desc:'BE60 · Pressurized twin'},
  {icao:'BE80',mfr:'Beechcraft',model:'Queen Air',desc:'BE80 · Light twin'},
  {icao:'BE90',mfr:'Beechcraft',model:'King Air C90',desc:'BE90 · Turboprop twin',cls:'turboprop'},
  {icao:'BE9L',mfr:'Beechcraft',model:'King Air B100',desc:'BE9L · Turboprop twin',cls:'turboprop'},
  {icao:'B350',mfr:'Beechcraft',model:'King Air 350',desc:'B350 · Turboprop twin',cls:'turboprop'},
  {icao:'B190',mfr:'Beechcraft',model:'1900 Airliner',desc:'B190 · Regional turboprop',cls:'turboprop'},
  // Cessna / Textron
  {icao:'C150',mfr:'Cessna',model:'150 / 152',desc:'C150 · 100-110hp trainer'},
  {icao:'C172',mfr:'Cessna',model:'Skyhawk 172',desc:'C172 · 160-180hp, most popular'},
  {icao:'C175',mfr:'Cessna',model:'Skylark 175',desc:'C175 · 175hp variant'},
  {icao:'C177',mfr:'Cessna',model:'Cardinal 177',desc:'C177 · Cantilever wing'},
  {icao:'C180',mfr:'Cessna',model:'180 Skywagon',desc:'C180 · Tailwheel, 225hp'},
  {icao:'C182',mfr:'Cessna',model:'Skylane 182',desc:'C182 · 230hp, fixed gear'},
  {icao:'C185',mfr:'Cessna',model:'Skywagon 185',desc:'C185 · Tailwheel, 300hp'},
  {icao:'C205',mfr:'Cessna',model:'205 / Super Skylane',desc:'C205 · 260hp'},
  {icao:'C206',mfr:'Cessna',model:'Stationair 206',desc:'C206 · Utility, 300hp'},
  {icao:'C207',mfr:'Cessna',model:'Skywagon 207',desc:'C207 · 7-seat utility'},
  {icao:'C208',mfr:'Cessna',model:'Caravan 208',desc:'C208 · Turboprop utility',cls:'turboprop'},
  {icao:'C210',mfr:'Cessna',model:'Centurion 210',desc:'C210 · Retractable, 285-310hp'},
  {icao:'C310',mfr:'Cessna',model:'310',desc:'C310 · Twin, 260hp × 2'},
  {icao:'C340',mfr:'Cessna',model:'340',desc:'C340 · Pressurized twin'},
  {icao:'C402',mfr:'Cessna',model:'402 Businessliner',desc:'C402 · Commuter twin'},
  {icao:'C414',mfr:'Cessna',model:'Chancellor 414',desc:'C414 · Pressurized twin'},
  {icao:'C421',mfr:'Cessna',model:'Golden Eagle 421',desc:'C421 · Pressurized twin'},
  {icao:'C425',mfr:'Cessna',model:'Conquest I',desc:'C425 · Turboprop twin',cls:'turboprop'},
  {icao:'C441',mfr:'Cessna',model:'Conquest II',desc:'C441 · Turboprop twin',cls:'turboprop'},
  {icao:'C25A',mfr:'Cessna',model:'Citation CJ2',desc:'C25A · Light jet',cls:'jet'},
  {icao:'C25B',mfr:'Cessna',model:'Citation CJ3',desc:'C25B · Light jet',cls:'jet'},
  {icao:'C25C',mfr:'Cessna',model:'Citation CJ4',desc:'C25C · Light jet',cls:'jet'},
  {icao:'C500',mfr:'Cessna',model:'Citation I',desc:'C500 · Light jet',cls:'jet'},
  {icao:'C501',mfr:'Cessna',model:'Citation I/SP',desc:'C501 · Light jet',cls:'jet'},
  {icao:'C510',mfr:'Cessna',model:'Citation Mustang',desc:'C510 · VLJ',cls:'jet'},
  {icao:'C525',mfr:'Cessna',model:'CitationJet CJ1',desc:'C525 · Light jet',cls:'jet'},
  {icao:'C550',mfr:'Cessna',model:'Citation II',desc:'C550 · Light jet',cls:'jet'},
  {icao:'C560',mfr:'Cessna',model:'Citation V / Ultra',desc:'C560 · Mid jet',cls:'jet'},
  {icao:'C680',mfr:'Cessna',model:'Citation Sovereign',desc:'C680 · Mid jet',cls:'jet'},
  {icao:'C750',mfr:'Cessna',model:'Citation X',desc:'C750 · Large cabin jet',cls:'jet'},
  // Piper
  {icao:'PA18',mfr:'Piper',model:'Super Cub',desc:'PA18 · Tailwheel, 90-150hp'},
  {icao:'PA28',mfr:'Piper',model:'Cherokee / Archer / Warrior',desc:'PA28 · 140-235hp variants'},
  {icao:'PA32',mfr:'Piper',model:'Cherokee Six / Saratoga',desc:'PA32 · 300hp, 6-seat'},
  {icao:'PA34',mfr:'Piper',model:'Seneca',desc:'PA34 · Twin, 200hp × 2'},
  {icao:'PA38',mfr:'Piper',model:'Tomahawk',desc:'PA38 · 112hp trainer'},
  {icao:'PA44',mfr:'Piper',model:'Seminole',desc:'PA44 · Twin trainer, 180hp × 2'},
  {icao:'PA46',mfr:'Piper',model:'Malibu / Mirage / Matrix',desc:'PA46 · Pressurized, 350hp'},
  {icao:'P46T',mfr:'Piper',model:'Malibu Meridian',desc:'P46T · Turboprop single',cls:'turboprop'},
  {icao:'PA24',mfr:'Piper',model:'Comanche',desc:'PA24 · Retractable, 180-400hp'},
  {icao:'PA30',mfr:'Piper',model:'Twin Comanche',desc:'PA30 · Light twin'},
  {icao:'PA31',mfr:'Piper',model:'Navajo',desc:'PA31 · Twin, 310hp × 2'},
  {icao:'PA42',mfr:'Piper',model:'Cheyenne',desc:'PA42 · Turboprop twin',cls:'turboprop'},
  // Mooney
  {icao:'M20P',mfr:'Mooney',model:'M20 201 / 231 / 252',desc:'M20P · Retractable, 200-231hp'},
  {icao:'M20T',mfr:'Mooney',model:'Acclaim Type S',desc:'M20T · Turbo, 280hp'},
  {icao:'M20J',mfr:'Mooney',model:'M20J 201',desc:'M20J · 200hp'},
  {icao:'M20K',mfr:'Mooney',model:'M20K 231 / 252',desc:'M20K · Turbo 210-220hp'},
  // Cirrus
  {icao:'SR20',mfr:'Cirrus',model:'SR20',desc:'SR20 · CAPS, 200hp'},
  {icao:'SR22',mfr:'Cirrus',model:'SR22 / SR22T',desc:'SR22 · CAPS, 310hp'},
  {icao:'SF50',mfr:'Cirrus',model:'SF50 Vision Jet',desc:'SF50 · Single-engine VLJ, CAPS',cls:'jet'},
  // Diamond
  {icao:'DA40',mfr:'Diamond',model:'DA40 Diamond Star',desc:'DA40 · 180hp, composite'},
  {icao:'DA42',mfr:'Diamond',model:'DA42 Twin Star',desc:'DA42 · Diesel twin'},
  {icao:'DA62',mfr:'Diamond',model:'DA62',desc:'DA62 · Twin diesel, 7-seat'},
  // Socata / TBM
  {icao:'TBM7',mfr:'Socata',model:'TBM 700',desc:'TBM7 · Turboprop single',cls:'turboprop'},
  {icao:'TBM8',mfr:'Socata',model:'TBM 850 / 900',desc:'TBM8 · Turboprop single',cls:'turboprop'},
  {icao:'TBM9',mfr:'Socata',model:'TBM 940 / 960',desc:'TBM9 · Turboprop single',cls:'turboprop'},
  // Pilatus
  {icao:'PC12',mfr:'Pilatus',model:'PC-12',desc:'PC12 · Turboprop single, utility',cls:'turboprop'},
  {icao:'PC24',mfr:'Pilatus',model:'PC-24',desc:'PC24 · Business jet',cls:'jet'},
  // Extra / Aerobatic
  {icao:'EXTR',mfr:'Extra',model:'Extra 300 / 330',desc:'EXTR · Aerobatic, 300hp'},
  // American General / Grumman
  {icao:'AA5B',mfr:'Grumman',model:'Tiger AA-5B',desc:'AA5B · 180hp'},
  {icao:'AA1',mfr:'Grumman',model:'Yankee AA-1',desc:'AA1 · 108hp trainer'},
  // Columbia / Lancair
  {icao:'LC40',mfr:'Columbia',model:'Columbia 300 / 400',desc:'LC40 · 310hp, composite'},
  // Velocity
  {icao:'VELO',mfr:'Velocity',model:'Velocity XL',desc:'VELO · Canard kit'},
  // Experimental / RV
  {icao:'RV4',mfr:'Van\'s Aircraft',model:'RV-4',desc:'RV4 · Kit, 150-200hp'},
  {icao:'RV6',mfr:'Van\'s Aircraft',model:'RV-6 / 6A',desc:'RV6 · Kit, 150-200hp'},
  {icao:'RV7',mfr:'Van\'s Aircraft',model:'RV-7 / 7A',desc:'RV7 · Kit, 160-200hp'},
  {icao:'RV8',mfr:'Van\'s Aircraft',model:'RV-8',desc:'RV8 · Tandem kit'},
  {icao:'RV10',mfr:'Van\'s Aircraft',model:'RV-10',desc:'RV10 · 4-seat kit'},
  {icao:'RV12',mfr:'Van\'s Aircraft',model:'RV-12 / LSA',desc:'RV12 · Light sport kit'},
  // Maule
  {icao:'M7',mfr:'Maule',model:'M-7 Star Rocket',desc:'M7 · STOL, 235hp'},
  // Kitfox / Avid
  {icao:'KITF',mfr:'Kitfox',model:'Kitfox Series',desc:'KITF · Tube/fabric kit'},
  // Zenith
  {icao:'CH70',mfr:'Zenith',model:'CH 701 / 750',desc:'CH70 · STOL kit'},
  // Glasair
  {icao:'GLAS',mfr:'Glasair',model:'Glasair III / Sportsman',desc:'GLAS · Composite kit'},
  // Lancair
  {icao:'LNC2',mfr:'Lancair',model:'Lancair 235 / 320',desc:'LNC2 · High-perf kit'},
  {icao:'IV',mfr:'Lancair',model:'Lancair IV / IV-P',desc:'IV · Pressurized kit'},
  // Eurocopter / Airbus Helicopters
  {icao:'EC35',mfr:'Airbus Helicopters',model:'H135 / EC135',desc:'EC35 · Light twin helo',cls:'turboprop'},
  {icao:'R22',mfr:'Robinson',model:'R22',desc:'R22 · 2-seat light helo'},
  {icao:'R44',mfr:'Robinson',model:'R44 Raven',desc:'R44 · 4-seat light helo'},
  {icao:'R66',mfr:'Robinson',model:'R66 Turbine',desc:'R66 · Turbine helo',cls:'turboprop'},

  // ── Very light / light jets ────────────────────────────────────────────────
  {icao:'E50P',mfr:'Embraer',model:'Phenom 100 / 100EV',desc:'E50P · VLJ, twin turbofan',cls:'jet'},
  {icao:'E55P',mfr:'Embraer',model:'Phenom 300 / 300E',desc:'E55P · Light jet',cls:'jet'},
  {icao:'HDJT',mfr:'Honda Aircraft',model:'HondaJet HA-420',desc:'HDJT · VLJ, over-wing engines',cls:'jet'},
  {icao:'EA50',mfr:'Eclipse',model:'Eclipse 500 / 550',desc:'EA50 · VLJ',cls:'jet'},
  {icao:'C25M',mfr:'Cessna',model:'Citation M2',desc:'C25M · Light jet',cls:'jet'},
  {icao:'C56X',mfr:'Cessna',model:'Citation Excel / XLS+',desc:'C56X · Mid-size jet',cls:'jet'},
  {icao:'C68A',mfr:'Cessna',model:'Citation Latitude',desc:'C68A · Mid-size jet',cls:'jet'},
  {icao:'C700',mfr:'Cessna',model:'Citation Longitude',desc:'C700 · Super-mid jet',cls:'jet'},
  // ── Mid / super-mid / heavy ────────────────────────────────────────────────
  {icao:'LJ35',mfr:'Learjet',model:'Learjet 35 / 36',desc:'LJ35 · Light jet',cls:'jet'},
  {icao:'LJ45',mfr:'Learjet',model:'Learjet 40 / 45',desc:'LJ45 · Light jet',cls:'jet'},
  {icao:'LJ60',mfr:'Learjet',model:'Learjet 60 / 60XR',desc:'LJ60 · Mid-size jet',cls:'jet'},
  {icao:'LJ75',mfr:'Learjet',model:'Learjet 70 / 75',desc:'LJ75 · Light jet',cls:'jet'},
  {icao:'BE40',mfr:'Beechcraft',model:'Beechjet 400A / Hawker 400XP',desc:'BE40 · Light jet',cls:'jet'},
  {icao:'H25B',mfr:'Hawker',model:'Hawker 800XP / 850XP / 900XP',desc:'H25B · Mid-size jet',cls:'jet'},
  {icao:'CL30',mfr:'Bombardier',model:'Challenger 300',desc:'CL30 · Super-mid jet',cls:'jet'},
  {icao:'CL35',mfr:'Bombardier',model:'Challenger 350 / 3500',desc:'CL35 · Super-mid jet',cls:'jet'},
  {icao:'CL60',mfr:'Bombardier',model:'Challenger 604 / 605 / 650',desc:'CL60 · Large-cabin jet',cls:'jet'},
  {icao:'GL5T',mfr:'Bombardier',model:'Global 5000',desc:'GL5T · Long-range jet',cls:'jet'},
  {icao:'GL6T',mfr:'Bombardier',model:'Global 6000 / XRS',desc:'GL6T · Long-range jet',cls:'jet'},
  {icao:'F2TH',mfr:'Dassault',model:'Falcon 2000 / 2000EX / LXS',desc:'F2TH · Large-cabin jet',cls:'jet'},
  {icao:'F900',mfr:'Dassault',model:'Falcon 900 / 900EX / LX',desc:'F900 · Trijet',cls:'jet'},
  {icao:'FA7X',mfr:'Dassault',model:'Falcon 7X',desc:'FA7X · Long-range trijet',cls:'jet'},
  {icao:'GALX',mfr:'Gulfstream',model:'G200 / Galaxy',desc:'GALX · Super-mid jet',cls:'jet'},
  {icao:'G280',mfr:'Gulfstream',model:'G280',desc:'G280 · Super-mid jet',cls:'jet'},
  {icao:'GLF4',mfr:'Gulfstream',model:'G350 / G450 / GIV',desc:'GLF4 · Large-cabin jet',cls:'jet'},
  {icao:'GLF5',mfr:'Gulfstream',model:'G500 / G550 / GV',desc:'GLF5 · Long-range jet',cls:'jet'},
  {icao:'GLF6',mfr:'Gulfstream',model:'G600 / G650 / G650ER',desc:'GLF6 · Long-range jet',cls:'jet'},
  {icao:'E545',mfr:'Embraer',model:'Legacy 450 / Praetor 500',desc:'E545 · Mid-size jet',cls:'jet'},
  {icao:'E550',mfr:'Embraer',model:'Legacy 500 / Praetor 600',desc:'E550 · Super-mid jet',cls:'jet'},
  // ── Turboprops ─────────────────────────────────────────────────────────────
  {icao:'BE20',mfr:'Beechcraft',model:'King Air 200 / 250 / 260',desc:'BE20 · Turboprop twin',cls:'turboprop'},
  {icao:'KODI',mfr:'Daher',model:'Kodiak 100 / 900',desc:'KODI · STOL turboprop utility',cls:'turboprop'},
  {icao:'M600',mfr:'Piper',model:'M500 / M600 SLS',desc:'M600 · Turboprop single',cls:'turboprop'},
];

export const AP_FULL: Record<string, string> = {
  KPIE:'St. Pete-Clearwater Intl',KTPA:'Tampa Intl',KVDF:'Tampa Executive Airport',
  KCGC:'Crystal River Airport',KZPH:'Zephyrhills Municipal',KPCM:'Plant City Airport',
  KSEF:'Sebring Regional Airport',KOCF:'Ocala Intl Airport',KGNV:'Gainesville Regional',
  KTLH:'Tallahassee Intl Airport',KPNS:'Pensacola Intl Airport',KECP:'Northwest Florida Beaches Intl',
  KFMY:'Page Field Ft Myers',KRSW:'Southwest Florida Intl',KMIA:'Miami Intl Airport',
  KFLL:'Fort Lauderdale-Hollywood Intl',KPBI:'Palm Beach Intl Airport',
  KORL:'Orlando Executive Airport',KMCO:'Orlando Intl Airport',KSFB:'Orlando Sanford Intl',
  KDAB:'Daytona Beach Intl Airport',KJAX:'Jacksonville Intl Airport',KCRG:'Jacksonville Executive at Craig',
  KSRQ:'Sarasota Bradenton Intl',KSPG:'Albert Whitted Airport',KBOW:'Bartow Executive Airport',
  KLAL:'Lakeland Linder Regional',KPGD:'Punta Gorda Airport',KVNC:'Venice Municipal Airport',
  KAPF:'Naples Municipal Airport',KFPR:'Treasure Coast Intl',KDED:'DeLand Municipal Airport',
  KGIF:'Winter Haven Regional',KEVB:'New Smyrna Beach Municipal',KISM:'Kissimmee Gateway Airport',
  KCLW:'Clearwater Air Park',KPMP:'Pompano Beach Airpark',KHWO:'North Perry Airport',
  KOPF:'Opa-Locka Executive Airport',KTMB:'Miami Executive Airport',KEYW:'Key West Intl Airport',
  KSAV:'Savannah/Hilton Head Intl',KATL:'Hartsfield-Jackson Atlanta Intl',KCLT:'Charlotte Douglas Intl',
  KRDU:'Raleigh-Durham Intl',KCHS:'Charleston Intl / AFB',KMYR:'Myrtle Beach Intl',
  KBOS:'Boston Logan Intl',KJFK:'John F Kennedy Intl',KLGA:'LaGuardia Airport',
  KEWR:'Newark Liberty Intl',KORD:"Chicago O'Hare Intl",KMDW:'Chicago Midway Intl',
  KDTW:'Detroit Metropolitan Wayne County',KCLE:'Cleveland Hopkins Intl',KPIT:'Pittsburgh Intl',
  KBWI:'Baltimore/Washington Intl',KDCA:'Ronald Reagan Washington National',KIAD:'Washington Dulles Intl',
  KPHL:'Philadelphia Intl',KLAX:'Los Angeles Intl',KSFO:'San Francisco Intl',
  KLAS:'Harry Reid Intl Las Vegas',KPHX:'Phoenix Sky Harbor Intl',KDEN:'Denver Intl',
  KSLC:'Salt Lake City Intl',KSEA:'Seattle-Tacoma Intl',KPDX:'Portland Intl Oregon',
  KMSP:'Minneapolis-St Paul Intl',KSTL:"St Louis Lambert Intl",KMEM:'Memphis Intl',
  KBHM:'Birmingham-Shuttlesworth Intl',KHSV:'Huntsville Intl',KMOB:'Mobile Regional',
  KMSY:'Louis Armstrong New Orleans Intl',KIAN:'Jackson-Medgar Wiley Evers Intl',
  KLIT:'Bill & Hillary Clinton National',KTUL:'Tulsa Intl',KOKC:'Will Rogers World Airport',
  KABQ:'Albuquerque Intl Sunport',KIAH:'George Bush Intercontinental',KDAL:'Dallas Love Field',
  KDFW:'Dallas/Fort Worth Intl',KHOU:'William P Hobby Airport',KAUS:'Austin-Bergstrom Intl',
  KSAT:'San Antonio Intl',KSAN:'San Diego Intl',KOAK:'Oakland Metropolitan Intl',
  KSJC:'Norman Y. Mineta San Jose Intl',KSMF:'Sacramento Intl',KVNY:'Van Nuys Airport',
  KHND:'Henderson Executive Airport',PANC:'Ted Stevens Anchorage Intl',PHNL:'Daniel K Inouye Intl Honolulu',
  TJSJ:'Luis Munoz Marin Intl',KTPF:'Peter O Knight Airport',KCHN:'Hernando County Airport',
  KCOI:'Merritt Island Airport',KSGJ:'Northeast Florida Regional',KBKV:'Brooksville-Tampa Bay Regional',
  KFIN:'Flagler Executive Airport',KSSI:'Brunswick Golden Isles Airport',KLEE:'Leesburg Intl Airport',
  KMKY:'Marco Island Executive',KFXE:'Fort Lauderdale Executive Airport',KBCT:'Boca Raton Airport',
  KVRB:'Vero Beach Regional Airport',KLCQ:'Lake City Gateway Airport',KFHB:'Fernandina Beach Municipal',
  KAVL:'Asheville Regional Airport',KGSP:'Greenville-Spartanburg Intl',
  MYNN:'Lynden Pindling Intl Nassau',
};

export const ENGINE_DB: Engine[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // LYCOMING — O-235 / O-290 / O-320 / O-360 / IO-360 / IO-390
  // ════════════════════════════════════════════════════════════════════════════
  {id:'O-235-C1',      mfr:'Lycoming',model:'O-235-C1',      hp:108, tbo:2000,type:'Piston',app:'Cessna 150 early'},
  {id:'O-235-L2C',     mfr:'Lycoming',model:'O-235-L2C',     hp:118, tbo:2000,type:'Piston',app:'Cessna 152'},
  {id:'O-290-D',       mfr:'Lycoming',model:'O-290-D',       hp:135, tbo:2000,type:'Piston',app:'Piper PA-22'},
  {id:'O-320-A',       mfr:'Lycoming',model:'O-320-A',       hp:150, tbo:2000,type:'Piston',app:'PA-28-150'},
  {id:'O-320-B2C',     mfr:'Lycoming',model:'O-320-B2C',     hp:160, tbo:2000,type:'Piston',app:'C172 N/P'},
  {id:'O-320-D2J',     mfr:'Lycoming',model:'O-320-D2J',     hp:160, tbo:2000,type:'Piston',app:'C172 S (carb)'},
  {id:'O-320-E2D',     mfr:'Lycoming',model:'O-320-E2D',     hp:150, tbo:2000,type:'Piston',app:'PA-28-150/151'},
  {id:'O-320-H2AD',    mfr:'Lycoming',model:'O-320-H2AD',    hp:160, tbo:1200,type:'Piston',app:'C172 (narrow-deck)'},
  {id:'O-360-A1A',     mfr:'Lycoming',model:'O-360-A1A',     hp:180, tbo:2000,type:'Piston',app:'PA-28-180'},
  {id:'O-360-A1F6',    mfr:'Lycoming',model:'O-360-A1F6',    hp:180, tbo:2000,type:'Piston',app:'PA-28-181 Archer III'},
  {id:'O-360-A4A',     mfr:'Lycoming',model:'O-360-A4A',     hp:180, tbo:2000,type:'Piston',app:'Grumman AA-5'},
  {id:'O-360-A4M',     mfr:'Lycoming',model:'O-360-A4M',     hp:180, tbo:2000,type:'Piston',app:'PA-28-181 Archer II'},
  {id:'O-360-C1G',     mfr:'Lycoming',model:'O-360-C1G',     hp:180, tbo:2000,type:'Piston',app:'C172 RG Cutlass'},
  {id:'O-360-E1AD',    mfr:'Lycoming',model:'O-360-E1AD',    hp:180, tbo:2000,type:'Piston',app:'Cessna R172K'},
  {id:'IO-360-A1A',    mfr:'Lycoming',model:'IO-360-A1A',    hp:200, tbo:1800,type:'Piston',app:'Piper Arrow PA-28R'},
  {id:'IO-360-A1B6',   mfr:'Lycoming',model:'IO-360-A1B6',   hp:180, tbo:2000,type:'Piston',app:'C172 R/S'},
  {id:'IO-360-B1E',    mfr:'Lycoming',model:'IO-360-B1E',    hp:200, tbo:1800,type:'Piston',app:'Piper Arrow III'},
  {id:'IO-360-C1C6',   mfr:'Lycoming',model:'IO-360-C1C6',   hp:200, tbo:1800,type:'Piston',app:'Mooney M20J'},
  {id:'IO-360-L2A',    mfr:'Lycoming',model:'IO-360-L2A',    hp:180, tbo:2000,type:'Piston',app:'Diamond DA40'},
  {id:'IO-360-M1A',    mfr:'Lycoming',model:'IO-360-M1A',    hp:180, tbo:2000,type:'Piston',app:'Diamond DA40-TDI alt'},
  {id:'AEIO-360-A1E',  mfr:'Lycoming',model:'AEIO-360-A1E',  hp:200, tbo:1800,type:'Piston',app:'Aerobatic'},
  {id:'AEIO-360-H1B',  mfr:'Lycoming',model:'AEIO-360-H1B',  hp:180, tbo:1800,type:'Piston',app:'Aerobatic'},
  {id:'HIO-360-D1A',   mfr:'Lycoming',model:'HIO-360-D1A',   hp:190, tbo:2000,type:'Piston',app:'Helicopter'},
  {id:'TIO-360-C1A6D', mfr:'Lycoming',model:'TIO-360-C1A6D', hp:210, tbo:1800,type:'Piston',app:'Piper Arrow IV Turbo'},
  {id:'IO-390-A3B6',   mfr:'Lycoming',model:'IO-390-A3B6',   hp:210, tbo:2000,type:'Piston',app:'C172 Nav III / S latest'},

  // ════════════════════════════════════════════════════════════════════════════
  // LYCOMING — O-540 / IO-540 (naturally aspirated)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'O-540-A1D5',    mfr:'Lycoming',model:'O-540-A1D5',    hp:235, tbo:2000,type:'Piston',app:'PA-32-260 Cherokee Six'},
  {id:'O-540-B4B5',    mfr:'Lycoming',model:'O-540-B4B5',    hp:235, tbo:2000,type:'Piston',app:'PA-32-260'},
  {id:'O-540-E4B5',    mfr:'Lycoming',model:'O-540-E4B5',    hp:235, tbo:2000,type:'Piston',app:'PA-32-260 late'},
  {id:'O-540-F1B5',    mfr:'Lycoming',model:'O-540-F1B5',    hp:235, tbo:2000,type:'Piston',app:'Robinson R44'},
  {id:'O-540-J3A5',    mfr:'Lycoming',model:'O-540-J3A5',    hp:235, tbo:2000,type:'Piston',app:'PA-32-301 Saratoga'},
  {id:'IO-540-A1A5',   mfr:'Lycoming',model:'IO-540-A1A5',   hp:290, tbo:2000,type:'Piston',app:'Piper Navajo PA-31'},
  {id:'IO-540-AA1A5',  mfr:'Lycoming',model:'IO-540-AA1A5',  hp:300, tbo:1800,type:'Piston',app:'PA-32R-300 Saratoga'},
  {id:'IO-540-AB1A5',  mfr:'Lycoming',model:'IO-540-AB1A5',  hp:230, tbo:2000,type:'Piston',app:'Cessna 182T'},
  {id:'IO-540-AC1A5',  mfr:'Lycoming',model:'IO-540-AC1A5',  hp:300, tbo:1800,type:'Piston',app:'Cessna 206H Stationair'},
  {id:'IO-540-AE1A5',  mfr:'Lycoming',model:'IO-540-AE1A5',  hp:235, tbo:2000,type:'Piston',app:'PA-32-300'},
  {id:'IO-540-AF1A5',  mfr:'Lycoming',model:'IO-540-AF1A5',  hp:235, tbo:2000,type:'Piston',app:'PA-32-301'},
  {id:'IO-540-AG1A5',  mfr:'Lycoming',model:'IO-540-AG1A5',  hp:300, tbo:1800,type:'Piston',app:'C206H'},
  {id:'IO-540-C4B5',   mfr:'Lycoming',model:'IO-540-C4B5',   hp:250, tbo:2000,type:'Piston',app:'Piper Comanche 260'},
  {id:'IO-540-D4A5',   mfr:'Lycoming',model:'IO-540-D4A5',   hp:260, tbo:2000,type:'Piston',app:'Britten-Norman Islander'},
  {id:'IO-540-E1A5',   mfr:'Lycoming',model:'IO-540-E1A5',   hp:260, tbo:2000,type:'Piston',app:'Twin Comanche PA-30'},
  {id:'IO-540-G1A5',   mfr:'Lycoming',model:'IO-540-G1A5',   hp:260, tbo:2000,type:'Piston',app:'PA-31 Navajo early'},
  {id:'IO-540-J4A5',   mfr:'Lycoming',model:'IO-540-J4A5',   hp:300, tbo:2000,type:'Piston',app:'Piper Navajo'},
  {id:'IO-540-K1A5',   mfr:'Lycoming',model:'IO-540-K1A5',   hp:300, tbo:2000,type:'Piston',app:'Beechcraft A36 Bonanza'},
  {id:'IO-540-K1B5',   mfr:'Lycoming',model:'IO-540-K1B5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K1C5',   mfr:'Lycoming',model:'IO-540-K1C5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K1D5',   mfr:'Lycoming',model:'IO-540-K1D5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K1E5',   mfr:'Lycoming',model:'IO-540-K1E5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K1F5',   mfr:'Lycoming',model:'IO-540-K1F5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K1G5',   mfr:'Lycoming',model:'IO-540-K1G5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K1H5',   mfr:'Lycoming',model:'IO-540-K1H5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K1J5',   mfr:'Lycoming',model:'IO-540-K1J5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-K2A5',   mfr:'Lycoming',model:'IO-540-K2A5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-L1A5',   mfr:'Lycoming',model:'IO-540-L1A5',   hp:300, tbo:1800,type:'Piston',app:'PA-32R-300'},
  {id:'IO-540-M1A5',   mfr:'Lycoming',model:'IO-540-M1A5',   hp:300, tbo:1800,type:'Piston',app:'PA-32R-300'},
  {id:'IO-540-N1A5',   mfr:'Lycoming',model:'IO-540-N1A5',   hp:300, tbo:2000,type:'Piston',app:'Piper Seneca II'},
  {id:'IO-540-P1A5',   mfr:'Lycoming',model:'IO-540-P1A5',   hp:300, tbo:2000,type:'Piston',app:'Piper PA-31'},
  {id:'IO-540-R1A5',   mfr:'Lycoming',model:'IO-540-R1A5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-S1A5',   mfr:'Lycoming',model:'IO-540-S1A5',   hp:300, tbo:1800,type:'Piston',app:'Piper Saratoga II'},
  {id:'IO-540-T4A5D',  mfr:'Lycoming',model:'IO-540-T4A5D',  hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-V4A5',   mfr:'Lycoming',model:'IO-540-V4A5',   hp:300, tbo:2000,type:'Piston',app:'Bonanza A36'},
  {id:'IO-540-W1A5',   mfr:'Lycoming',model:'IO-540-W1A5',   hp:300, tbo:1800,type:'Piston',app:'Cessna 206H'},
  {id:'AEIO-540-D4A5', mfr:'Lycoming',model:'AEIO-540-D4A5', hp:260, tbo:1800,type:'Piston',app:'Aerobatic — Extra 300/CAP'},
  {id:'AEIO-540-L1B5', mfr:'Lycoming',model:'AEIO-540-L1B5', hp:300, tbo:1800,type:'Piston',app:'Aerobatic — Extra 300L'},
  {id:'HIO-540-A1A',   mfr:'Lycoming',model:'HIO-540-A1A',   hp:305, tbo:1800,type:'Piston',app:'Sikorsky S-52 helicopter'},

  // ════════════════════════════════════════════════════════════════════════════
  // LYCOMING — TIO-540 (turbocharged)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'TIO-540-A2B',   mfr:'Lycoming',model:'TIO-540-A2B',   hp:290, tbo:1800,type:'Piston',app:'Piper PA-31 Navajo turbo'},
  {id:'TIO-540-AA1AD', mfr:'Lycoming',model:'TIO-540-AA1AD', hp:350, tbo:1800,type:'Piston',app:'Piper Mojave'},
  {id:'TIO-540-AB1AD', mfr:'Lycoming',model:'TIO-540-AB1AD', hp:350, tbo:1800,type:'Piston',app:'PA-31T Cheyenne'},
  {id:'TIO-540-AF1A',  mfr:'Lycoming',model:'TIO-540-AF1A',  hp:300, tbo:1800,type:'Piston',app:'Piper Seneca III'},
  {id:'TIO-540-AF1B',  mfr:'Lycoming',model:'TIO-540-AF1B',  hp:300, tbo:1800,type:'Piston',app:'Piper Seneca IV/V'},
  {id:'TIO-540-AH1A',  mfr:'Lycoming',model:'TIO-540-AH1A',  hp:350, tbo:1800,type:'Piston',app:'Piper PA-31P Pressurized'},
  {id:'TIO-540-AJ1A',  mfr:'Lycoming',model:'TIO-540-AJ1A',  hp:350, tbo:1800,type:'Piston',app:'Piper PA-31P'},
  {id:'TIO-540-AK1A',  mfr:'Lycoming',model:'TIO-540-AK1A',  hp:235, tbo:1800,type:'Piston',app:'Cessna T182 Skylane RG'},
  {id:'TIO-540-C1A',   mfr:'Lycoming',model:'TIO-540-C1A',   hp:300, tbo:1800,type:'Piston',app:'Piper Seneca II'},
  {id:'TIO-540-E1A',   mfr:'Lycoming',model:'TIO-540-E1A',   hp:300, tbo:1800,type:'Piston',app:'Piper Seneca II'},
  {id:'TIO-540-F2BD',  mfr:'Lycoming',model:'TIO-540-F2BD',  hp:350, tbo:1800,type:'Piston',app:'Piper PA-31P'},
  {id:'TIO-540-G1A',   mfr:'Lycoming',model:'TIO-540-G1A',   hp:300, tbo:1800,type:'Piston',app:'Piper Seneca II'},
  {id:'TIO-540-H1A',   mfr:'Lycoming',model:'TIO-540-H1A',   hp:300, tbo:1800,type:'Piston',app:'Piper Seneca II'},
  {id:'TIO-540-J2BD',  mfr:'Lycoming',model:'TIO-540-J2BD',  hp:350, tbo:1800,type:'Piston',app:'Piper PA-31P'},
  {id:'TIO-540-S1AD',  mfr:'Lycoming',model:'TIO-540-S1AD',  hp:350, tbo:1800,type:'Piston',app:'Piper Navajo Chieftain'},
  {id:'TIO-540-U2A',   mfr:'Lycoming',model:'TIO-540-U2A',   hp:350, tbo:1800,type:'Piston',app:'PA-31-350 Chieftain'},
  {id:'LTIO-540-J2BD', mfr:'Lycoming',model:'LTIO-540-J2BD', hp:350, tbo:1800,type:'Piston',app:'PA-31P left rotation'},

  // ════════════════════════════════════════════════════════════════════════════
  // LYCOMING — TIO-541 / TIGO-541
  // ════════════════════════════════════════════════════════════════════════════
  {id:'TIO-541-E1A4',  mfr:'Lycoming',model:'TIO-541-E1A4',  hp:380, tbo:1600,type:'Piston',app:'Beechcraft Duke B60'},
  {id:'TIGO-541-E1A',  mfr:'Lycoming',model:'TIGO-541-E1A',  hp:380, tbo:1400,type:'Piston',app:'Beechcraft Duke A60'},

  // ════════════════════════════════════════════════════════════════════════════
  // LYCOMING — IO-580 / IO-720
  // ════════════════════════════════════════════════════════════════════════════
  {id:'IO-580-B1A',    mfr:'Lycoming',model:'IO-580-B1A',    hp:315, tbo:1800,type:'Piston',app:'Evektor VUT100'},
  {id:'AEIO-580-B1A',  mfr:'Lycoming',model:'AEIO-580-B1A',  hp:315, tbo:1800,type:'Piston',app:'Extra 330LC'},
  {id:'IO-720-A1B',    mfr:'Lycoming',model:'IO-720-A1B',    hp:400, tbo:1800,type:'Piston',app:'8-cyl / ag aircraft'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — O-200 / O-300 / C-85 / C-90
  // ════════════════════════════════════════════════════════════════════════════
  {id:'C-85-12',       mfr:'Continental',model:'C-85-12',    hp:85,  tbo:1800,type:'Piston',app:'Cessna 120/140'},
  {id:'C-90-12F',      mfr:'Continental',model:'C-90-12F',   hp:95,  tbo:1800,type:'Piston',app:'Cessna 150 early'},
  {id:'O-200-A',       mfr:'Continental',model:'O-200-A',    hp:100, tbo:1800,type:'Piston',app:'Cessna 150'},
  {id:'O-200-B',       mfr:'Continental',model:'O-200-B',    hp:100, tbo:1800,type:'Piston',app:'Cessna 150 (carb alt)'},
  {id:'O-200-D',       mfr:'Continental',model:'O-200-D',    hp:100, tbo:2000,type:'Piston',app:'LSA / Rotax alt'},
  {id:'O-300-A',       mfr:'Continental',model:'O-300-A',    hp:145, tbo:1800,type:'Piston',app:'Cessna 172 early'},
  {id:'O-300-D',       mfr:'Continental',model:'O-300-D',    hp:145, tbo:1800,type:'Piston',app:'Cessna 172 C/D/E/F'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — O-470 / IO-470
  // ════════════════════════════════════════════════════════════════════════════
  {id:'O-470-K',       mfr:'Continental',model:'O-470-K',    hp:225, tbo:1500,type:'Piston',app:'Cessna 182 early'},
  {id:'O-470-L',       mfr:'Continental',model:'O-470-L',    hp:230, tbo:1500,type:'Piston',app:'Cessna 182 A-H'},
  {id:'O-470-R',       mfr:'Continental',model:'O-470-R',    hp:230, tbo:1500,type:'Piston',app:'Cessna 182 H/J/K'},
  {id:'O-470-S',       mfr:'Continental',model:'O-470-S',    hp:230, tbo:1500,type:'Piston',app:'Cessna 182 L/M/N/P'},
  {id:'O-470-U',       mfr:'Continental',model:'O-470-U',    hp:230, tbo:1500,type:'Piston',app:'Cessna 182 Q/R'},
  {id:'IO-470-C',      mfr:'Continental',model:'IO-470-C',   hp:225, tbo:1500,type:'Piston',app:'Beechcraft Bonanza E35'},
  {id:'IO-470-D',      mfr:'Continental',model:'IO-470-D',   hp:250, tbo:1500,type:'Piston',app:'Bonanza J35/K35'},
  {id:'IO-470-E',      mfr:'Continental',model:'IO-470-E',   hp:260, tbo:1500,type:'Piston',app:'Bonanza M35/N35'},
  {id:'IO-470-F',      mfr:'Continental',model:'IO-470-F',   hp:260, tbo:1500,type:'Piston',app:'Bonanza P35/S35'},
  {id:'IO-470-H',      mfr:'Continental',model:'IO-470-H',   hp:260, tbo:1500,type:'Piston',app:'Cessna 210 early'},
  {id:'IO-470-J',      mfr:'Continental',model:'IO-470-J',   hp:260, tbo:1500,type:'Piston',app:'Cessna 210A/B'},
  {id:'IO-470-L',      mfr:'Continental',model:'IO-470-L',   hp:260, tbo:1500,type:'Piston',app:'Cessna 210C-E'},
  {id:'IO-470-N',      mfr:'Continental',model:'IO-470-N',   hp:260, tbo:1500,type:'Piston',app:'Baron 55 early / C182R'},
  {id:'IO-470-R',      mfr:'Continental',model:'IO-470-R',   hp:260, tbo:1500,type:'Piston',app:'Cessna 210G/H'},
  {id:'IO-470-S',      mfr:'Continental',model:'IO-470-S',   hp:260, tbo:1500,type:'Piston',app:'Cessna 210J/K'},
  {id:'IO-470-U',      mfr:'Continental',model:'IO-470-U',   hp:260, tbo:1500,type:'Piston',app:'Baron 55'},
  {id:'IO-470-V',      mfr:'Continental',model:'IO-470-V',   hp:260, tbo:1500,type:'Piston',app:'Cessna 210L'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — IO-520 (naturally aspirated)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'IO-520-A',      mfr:'Continental',model:'IO-520-A',   hp:285, tbo:1700,type:'Piston',app:'Bonanza S35/V35'},
  {id:'IO-520-B',      mfr:'Continental',model:'IO-520-B',   hp:285, tbo:1700,type:'Piston',app:'Cessna 210L/M'},
  {id:'IO-520-BA',     mfr:'Continental',model:'IO-520-BA',  hp:285, tbo:1700,type:'Piston',app:'Baron 58 early'},
  {id:'IO-520-BB',     mfr:'Continental',model:'IO-520-BB',  hp:285, tbo:1700,type:'Piston',app:'Baron 58 cont.'},
  {id:'IO-520-C',      mfr:'Continental',model:'IO-520-C',   hp:285, tbo:1700,type:'Piston',app:'Cessna 210M'},
  {id:'IO-520-CB',     mfr:'Continental',model:'IO-520-CB',  hp:285, tbo:1700,type:'Piston',app:'Cessna 210N'},
  {id:'IO-520-D',      mfr:'Continental',model:'IO-520-D',   hp:285, tbo:1700,type:'Piston',app:'Cessna T-41 / 185E/F'},
  {id:'IO-520-E',      mfr:'Continental',model:'IO-520-E',   hp:300, tbo:1700,type:'Piston',app:'Bonanza V35B/A36'},
  {id:'IO-520-F',      mfr:'Continental',model:'IO-520-F',   hp:285, tbo:1700,type:'Piston',app:'Cessna 310Q/R'},
  {id:'IO-520-J',      mfr:'Continental',model:'IO-520-J',   hp:285, tbo:1700,type:'Piston',app:'Cessna 310'},
  {id:'IO-520-K',      mfr:'Continental',model:'IO-520-K',   hp:285, tbo:1700,type:'Piston',app:'Cessna 206/207'},
  {id:'IO-520-L',      mfr:'Continental',model:'IO-520-L',   hp:300, tbo:1700,type:'Piston',app:'Bonanza A36'},
  {id:'IO-520-M',      mfr:'Continental',model:'IO-520-M',   hp:285, tbo:1700,type:'Piston',app:'Cessna 210N/R'},
  {id:'IO-520-MB',     mfr:'Continental',model:'IO-520-MB',  hp:285, tbo:1700,type:'Piston',app:'Cessna 210'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — TSIO-520 (turbocharged)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'TSIO-520-B',    mfr:'Continental',model:'TSIO-520-B', hp:285, tbo:1600,type:'Piston',app:'Cessna T310/T337'},
  {id:'TSIO-520-BE',   mfr:'Continental',model:'TSIO-520-BE',hp:325, tbo:1600,type:'Piston',app:'Baron 58TC'},
  {id:'TSIO-520-C',    mfr:'Continental',model:'TSIO-520-C', hp:285, tbo:1600,type:'Piston',app:'Cessna T310'},
  {id:'TSIO-520-CE',   mfr:'Continental',model:'TSIO-520-CE',hp:325, tbo:1600,type:'Piston',app:'Baron 58TC late'},
  {id:'TSIO-520-D',    mfr:'Continental',model:'TSIO-520-D', hp:285, tbo:1600,type:'Piston',app:'Cessna T310R'},
  {id:'TSIO-520-E',    mfr:'Continental',model:'TSIO-520-E', hp:300, tbo:1600,type:'Piston',app:'Cessna T210'},
  {id:'TSIO-520-EB',   mfr:'Continental',model:'TSIO-520-EB',hp:310, tbo:1600,type:'Piston',app:'Cessna T210M/N'},
  {id:'TSIO-520-G',    mfr:'Continental',model:'TSIO-520-G', hp:285, tbo:1600,type:'Piston',app:'Cessna Skymaster T337'},
  {id:'TSIO-520-H',    mfr:'Continental',model:'TSIO-520-H', hp:285, tbo:1600,type:'Piston',app:'T337G Skymaster'},
  {id:'TSIO-520-J',    mfr:'Continental',model:'TSIO-520-J', hp:300, tbo:1600,type:'Piston',app:'Cessna T210L'},
  {id:'TSIO-520-JB',   mfr:'Continental',model:'TSIO-520-JB',hp:310, tbo:1600,type:'Piston',app:'Pressurized T210'},
  {id:'TSIO-520-L',    mfr:'Continental',model:'TSIO-520-L', hp:310, tbo:1600,type:'Piston',app:'Cessna P210N'},
  {id:'TSIO-520-LB',   mfr:'Continental',model:'TSIO-520-LB',hp:325, tbo:1600,type:'Piston',app:'P210R / Seneca III'},
  {id:'TSIO-520-M',    mfr:'Continental',model:'TSIO-520-M', hp:310, tbo:1600,type:'Piston',app:'Cessna P210'},
  {id:'TSIO-520-N',    mfr:'Continental',model:'TSIO-520-N', hp:310, tbo:1600,type:'Piston',app:'Cessna T340'},
  {id:'TSIO-520-NB',   mfr:'Continental',model:'TSIO-520-NB',hp:310, tbo:1600,type:'Piston',app:'Cessna 340A'},
  {id:'TSIO-520-P',    mfr:'Continental',model:'TSIO-520-P', hp:310, tbo:1600,type:'Piston',app:'Cessna T414A'},
  {id:'TSIO-520-R',    mfr:'Continental',model:'TSIO-520-R', hp:300, tbo:1600,type:'Piston',app:'Cessna T210'},
  {id:'TSIO-520-T',    mfr:'Continental',model:'TSIO-520-T', hp:310, tbo:1600,type:'Piston',app:'Cessna T310R'},
  {id:'TSIO-520-UB',   mfr:'Continental',model:'TSIO-520-UB',hp:325, tbo:1600,type:'Piston',app:'Beechcraft T34C'},
  {id:'TSIO-520-VB',   mfr:'Continental',model:'TSIO-520-VB',hp:325, tbo:1600,type:'Piston',app:'Beechcraft 58TC'},
  {id:'TSIO-520-WB',   mfr:'Continental',model:'TSIO-520-WB',hp:325, tbo:1600,type:'Piston',app:'Beechcraft 58TC late'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — GTSIO-520 (geared turbocharged)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'GTSIO-520-C',   mfr:'Continental',model:'GTSIO-520-C', hp:340, tbo:1200,type:'Piston',app:'Cessna 411'},
  {id:'GTSIO-520-D',   mfr:'Continental',model:'GTSIO-520-D', hp:375, tbo:1200,type:'Piston',app:'Cessna 421A/B'},
  {id:'GTSIO-520-F',   mfr:'Continental',model:'GTSIO-520-F', hp:375, tbo:1200,type:'Piston',app:'Cessna 404 Titan'},
  {id:'GTSIO-520-H',   mfr:'Continental',model:'GTSIO-520-H', hp:375, tbo:1200,type:'Piston',app:'Cessna 421C'},
  {id:'GTSIO-520-L',   mfr:'Continental',model:'GTSIO-520-L', hp:375, tbo:1200,type:'Piston',app:'Cessna 421C'},
  {id:'GTSIO-520-M',   mfr:'Continental',model:'GTSIO-520-M', hp:375, tbo:1200,type:'Piston',app:'Cessna 421C'},
  {id:'GTSIO-520-N',   mfr:'Continental',model:'GTSIO-520-N', hp:375, tbo:1200,type:'Piston',app:'Cessna 421C late'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — IO-550 (naturally aspirated)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'IO-550-A',      mfr:'Continental',model:'IO-550-A',   hp:300, tbo:1700,type:'Piston',app:'Cessna 185F/206H'},
  {id:'IO-550-B',      mfr:'Continental',model:'IO-550-B',   hp:300, tbo:1700,type:'Piston',app:'Bonanza G36 / A36 late'},
  {id:'IO-550-C',      mfr:'Continental',model:'IO-550-C',   hp:300, tbo:1700,type:'Piston',app:'Cessna 210R'},
  {id:'IO-550-D',      mfr:'Continental',model:'IO-550-D',   hp:300, tbo:1700,type:'Piston',app:'Cessna T303 Crusader'},
  {id:'IO-550-E',      mfr:'Continental',model:'IO-550-E',   hp:300, tbo:1700,type:'Piston',app:'Baron 58 late'},
  {id:'IO-550-F',      mfr:'Continental',model:'IO-550-F',   hp:300, tbo:1700,type:'Piston',app:'Mooney M20M / TLS'},
  {id:'IO-550-G',      mfr:'Continental',model:'IO-550-G',   hp:300, tbo:2000,type:'Piston',app:'Velocity XL / kit'},
  {id:'IO-550-L',      mfr:'Continental',model:'IO-550-L',   hp:300, tbo:1700,type:'Piston',app:'Bonanza G36'},
  {id:'IO-550-N',      mfr:'Continental',model:'IO-550-N',   hp:310, tbo:2000,type:'Piston',app:'Cirrus SR22 early'},
  {id:'IO-550-P',      mfr:'Continental',model:'IO-550-P',   hp:300, tbo:1700,type:'Piston',app:'Piper 6X'},
  {id:'IO-550-R',      mfr:'Continental',model:'IO-550-R',   hp:310, tbo:2000,type:'Piston',app:'Cirrus SR22 G2/G3'},
  {id:'IOF-550-P',     mfr:'Continental',model:'IOF-550-P',  hp:300, tbo:1700,type:'Piston',app:'FADEC — Piper 6X'},
  {id:'IOF-550-N',     mfr:'Continental',model:'IOF-550-N',  hp:310, tbo:2000,type:'Piston',app:'FADEC — Cirrus'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — TSIO-550 (turbocharged)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'TSIO-550-A',    mfr:'Continental',model:'TSIO-550-A', hp:350, tbo:1600,type:'Piston',app:'Cessna T303 Crusader'},
  {id:'TSIO-550-B',    mfr:'Continental',model:'TSIO-550-B', hp:350, tbo:1600,type:'Piston',app:'Piper PA-46T Malibu'},
  {id:'TSIO-550-C',    mfr:'Continental',model:'TSIO-550-C', hp:350, tbo:1600,type:'Piston',app:'Cessna Corvalis TTx'},
  {id:'TSIO-550-E',    mfr:'Continental',model:'TSIO-550-E', hp:350, tbo:1600,type:'Piston',app:'Cessna T182T'},
  {id:'TSIO-550-G',    mfr:'Continental',model:'TSIO-550-G', hp:350, tbo:1600,type:'Piston',app:'Cessna TTx late'},
  {id:'TSIO-550-K',    mfr:'Continental',model:'TSIO-550-K', hp:315, tbo:1600,type:'Piston',app:'Cirrus SR22T G5'},
  {id:'TSIOF-550-J',   mfr:'Continental',model:'TSIOF-550-J',hp:350, tbo:1600,type:'Piston',app:'FADEC — Columbia/TTx'},
  {id:'TSIOF-550-K',   mfr:'Continental',model:'TSIOF-550-K',hp:315, tbo:1600,type:'Piston',app:'FADEC — Cirrus SR22T'},

  // ════════════════════════════════════════════════════════════════════════════
  // CONTINENTAL — IO-360 / TSIO-360
  // ════════════════════════════════════════════════════════════════════════════
  {id:'IO-360-A',      mfr:'Continental',model:'IO-360-A',   hp:180, tbo:1500,type:'Piston',app:'Cessna Skymaster 337'},
  {id:'IO-360-CB',     mfr:'Continental',model:'IO-360-CB',  hp:195, tbo:1500,type:'Piston',app:'Cirrus SR20'},
  {id:'IO-360-D',      mfr:'Continental',model:'IO-360-D',   hp:210, tbo:1500,type:'Piston',app:'Cirrus SR20 G2/G3'},
  {id:'IO-360-ES',     mfr:'Continental',model:'IO-360-ES',  hp:210, tbo:1500,type:'Piston',app:'Mooney M20J'},
  {id:'IO-360-GB',     mfr:'Continental',model:'IO-360-GB',  hp:180, tbo:1800,type:'Piston',app:'Cessna 177RG Cardinal'},
  {id:'TSIO-360-A',    mfr:'Continental',model:'TSIO-360-A', hp:210, tbo:1600,type:'Piston',app:'Cessna T337'},
  {id:'TSIO-360-C',    mfr:'Continental',model:'TSIO-360-C', hp:225, tbo:1600,type:'Piston',app:'Piper Seneca I'},
  {id:'TSIO-360-E',    mfr:'Continental',model:'TSIO-360-E', hp:200, tbo:1600,type:'Piston',app:'Cessna T337'},
  {id:'TSIO-360-EB',   mfr:'Continental',model:'TSIO-360-EB',hp:200, tbo:1600,type:'Piston',app:'Piper Arrow Turbo'},
  {id:'TSIO-360-FB',   mfr:'Continental',model:'TSIO-360-FB',hp:200, tbo:1600,type:'Piston',app:'Piper Arrow IV Turbo'},
  {id:'TSIO-360-GB',   mfr:'Continental',model:'TSIO-360-GB',hp:225, tbo:1600,type:'Piston',app:'Piper Seneca II'},
  {id:'TSIO-360-HB',   mfr:'Continental',model:'TSIO-360-HB',hp:220, tbo:1600,type:'Piston',app:'Piper Seneca III'},
  {id:'TSIO-360-JB',   mfr:'Continental',model:'TSIO-360-JB',hp:220, tbo:1600,type:'Piston',app:'Beechcraft Duchess alt'},
  {id:'TSIO-360-KB',   mfr:'Continental',model:'TSIO-360-KB',hp:220, tbo:1600,type:'Piston',app:'Piper Seneca III late'},
  {id:'TSIO-360-LB',   mfr:'Continental',model:'TSIO-360-LB',hp:220, tbo:1600,type:'Piston',app:'Piper Seneca IV/V'},
  {id:'TSIO-360-MB',   mfr:'Continental',model:'TSIO-360-MB',hp:220, tbo:1600,type:'Piston',app:'Piper Seneca V late'},
  {id:'TSIO-360-SB',   mfr:'Continental',model:'TSIO-360-SB',hp:220, tbo:1600,type:'Piston',app:'Diamond DA42 alt'},

  // ════════════════════════════════════════════════════════════════════════════
  // ROTAX — Sport / LSA / UL
  // ════════════════════════════════════════════════════════════════════════════
  {id:'Rotax 582 UL',     mfr:'Rotax',model:'582 UL DCDI',     hp:65,  tbo:300, type:'Piston',app:'UL / powered parachute'},
  {id:'Rotax 912 UL',     mfr:'Rotax',model:'912 UL',           hp:80,  tbo:1500,type:'Piston',app:'Rans / Zenith / CT'},
  {id:'Rotax 912 ULS',    mfr:'Rotax',model:'912 ULS',          hp:100, tbo:1500,type:'Piston',app:'LSA — SportStar / C162'},
  {id:'Rotax 912 iS',     mfr:'Rotax',model:'912 iS Sport',     hp:100, tbo:2000,type:'Piston',app:'Pipistrel / Remos GXiS'},
  {id:'Rotax 912 iSc',    mfr:'Rotax',model:'912 iSc',          hp:100, tbo:2000,type:'Piston',app:'Commercial LSA'},
  {id:'Rotax 914 UL',     mfr:'Rotax',model:'914 UL Turbo',     hp:115, tbo:1000,type:'Piston',app:'Turbo LSA / Stemme'},
  {id:'Rotax 914 F',      mfr:'Rotax',model:'914 F Turbo',      hp:115, tbo:1000,type:'Piston',app:'Certified Turbo LSA'},
  {id:'Rotax 915 iS',     mfr:'Rotax',model:'915 iS',           hp:141, tbo:1500,type:'Piston',app:'SkyDart / Pipistrel'},
  {id:'Rotax 916 iS',     mfr:'Rotax',model:'916 iS',           hp:160, tbo:1500,type:'Piston',app:'High-perf LSA / UL'},

  // ════════════════════════════════════════════════════════════════════════════
  // PRATT & WHITNEY CANADA — PT6A Turboprop
  // ════════════════════════════════════════════════════════════════════════════
  {id:'PT6A-6',        mfr:'Pratt & Whitney Canada',model:'PT6A-6',   hp:550,  tbo:3600,type:'Turboprop',app:'DHC-6 Twin Otter early'},
  {id:'PT6A-20',       mfr:'Pratt & Whitney Canada',model:'PT6A-20',  hp:550,  tbo:3600,type:'Turboprop',app:'King Air C90 early'},
  {id:'PT6A-21',       mfr:'Pratt & Whitney Canada',model:'PT6A-21',  hp:550,  tbo:3600,type:'Turboprop',app:'Beech 99 / King Air'},
  {id:'PT6A-25',       mfr:'Pratt & Whitney Canada',model:'PT6A-25',  hp:550,  tbo:3600,type:'Turboprop',app:'T-34C Turbo Mentor'},
  {id:'PT6A-27',       mfr:'Pratt & Whitney Canada',model:'PT6A-27',  hp:680,  tbo:3600,type:'Turboprop',app:'DHC-6 Twin Otter'},
  {id:'PT6A-28',       mfr:'Pratt & Whitney Canada',model:'PT6A-28',  hp:680,  tbo:3600,type:'Turboprop',app:'Piper Navajo Chieftain'},
  {id:'PT6A-34',       mfr:'Pratt & Whitney Canada',model:'PT6A-34',  hp:750,  tbo:3600,type:'Turboprop',app:'Cheyenne II / BN-2T'},
  {id:'PT6A-34AG',     mfr:'Pratt & Whitney Canada',model:'PT6A-34AG',hp:750,  tbo:3600,type:'Turboprop',app:'Ag aircraft / Thrush'},
  {id:'PT6A-36',       mfr:'Pratt & Whitney Canada',model:'PT6A-36',  hp:783,  tbo:3600,type:'Turboprop',app:'Cessna Conquest I C425'},
  {id:'PT6A-38',       mfr:'Pratt & Whitney Canada',model:'PT6A-38',  hp:850,  tbo:3500,type:'Turboprop',app:'Cheyenne IIXL'},
  {id:'PT6A-41',       mfr:'Pratt & Whitney Canada',model:'PT6A-41',  hp:850,  tbo:3500,type:'Turboprop',app:'King Air 200'},
  {id:'PT6A-42',       mfr:'Pratt & Whitney Canada',model:'PT6A-42',  hp:850,  tbo:3500,type:'Turboprop',app:'PC-12/45'},
  {id:'PT6A-45A',      mfr:'Pratt & Whitney Canada',model:'PT6A-45A', hp:1020, tbo:3600,type:'Turboprop',app:'Shorts 330'},
  {id:'PT6A-45R',      mfr:'Pratt & Whitney Canada',model:'PT6A-45R', hp:1020, tbo:3600,type:'Turboprop',app:'DHC-7'},
  {id:'PT6A-47',       mfr:'Pratt & Whitney Canada',model:'PT6A-47',  hp:900,  tbo:3500,type:'Turboprop',app:'Cheyenne III'},
  {id:'PT6A-47B',      mfr:'Pratt & Whitney Canada',model:'PT6A-47B', hp:900,  tbo:3500,type:'Turboprop',app:'TBM 700 A/B'},
  {id:'PT6A-52',       mfr:'Pratt & Whitney Canada',model:'PT6A-52',  hp:1100, tbo:3600,type:'Turboprop',app:'Socata TBM 700C2'},
  {id:'PT6A-60A',      mfr:'Pratt & Whitney Canada',model:'PT6A-60A', hp:1050, tbo:3600,type:'Turboprop',app:'TBM 850 / TBM 900'},
  {id:'PT6A-60AG',     mfr:'Pratt & Whitney Canada',model:'PT6A-60AG',hp:1050, tbo:3600,type:'Turboprop',app:'Air Tractor AT-802'},
  {id:'PT6A-64',       mfr:'Pratt & Whitney Canada',model:'PT6A-64',  hp:1600, tbo:3600,type:'Turboprop',app:'Shorts 360'},
  {id:'PT6A-65B',      mfr:'Pratt & Whitney Canada',model:'PT6A-65B', hp:1394, tbo:3600,type:'Turboprop',app:'Cessna Caravan 208B'},
  {id:'PT6A-65R',      mfr:'Pratt & Whitney Canada',model:'PT6A-65R', hp:1394, tbo:3600,type:'Turboprop',app:'Cessna Caravan 208B EX'},
  {id:'PT6A-66D',      mfr:'Pratt & Whitney Canada',model:'PT6A-66D', hp:1825, tbo:3600,type:'Turboprop',app:'King Air 350 / 350i'},
  {id:'PT6A-67A',      mfr:'Pratt & Whitney Canada',model:'PT6A-67A', hp:1200, tbo:3500,type:'Turboprop',app:'Pilatus PC-12/47'},
  {id:'PT6A-67B',      mfr:'Pratt & Whitney Canada',model:'PT6A-67B', hp:1200, tbo:3500,type:'Turboprop',app:'PC-12/47E early'},
  {id:'PT6A-67P',      mfr:'Pratt & Whitney Canada',model:'PT6A-67P', hp:1200, tbo:3500,type:'Turboprop',app:'PC-12/47E late'},
  {id:'PT6A-114A',     mfr:'Pratt & Whitney Canada',model:'PT6A-114A',hp:870,  tbo:3600,type:'Turboprop',app:'Cessna Grand Caravan'},
  {id:'PT6A-135A',     mfr:'Pratt & Whitney Canada',model:'PT6A-135A',hp:750,  tbo:3600,type:'Turboprop',app:'King Air C90B/GT'},
  {id:'PT6A-140',      mfr:'Pratt & Whitney Canada',model:'PT6A-140', hp:875,  tbo:3600,type:'Turboprop',app:'TBM 940 / TBM 960'},
  {id:'PT6A-140A',     mfr:'Pratt & Whitney Canada',model:'PT6A-140A',hp:900,  tbo:3600,type:'Turboprop',app:'Daher Kodiak 100 / 900'},
  {id:'PT6A-42A',      mfr:'Pratt & Whitney Canada',model:'PT6A-42A',  hp:850,  tbo:3500,type:'Turboprop',app:'Pilatus PC-12/45 late'},
  {id:'PT6A-42A (M600)',mfr:'Pratt & Whitney Canada',model:'PT6A-42A (M600)',hp:600,tbo:3600,type:'Turboprop',app:'Piper M600 SLS'},
  {id:'PT6E-67XP',     mfr:'Pratt & Whitney Canada',model:'PT6E-67XP', hp:1845, tbo:3500,type:'Turboprop',app:'Pilatus PC-12 NGX'},
  {id:'PT6A-42A (M500)',mfr:'Pratt & Whitney Canada',model:'PT6A-42A (M500)',hp:500,tbo:3600,type:'Turboprop',app:'Piper M500 / Meridian'},

  // ════════════════════════════════════════════════════════════════════════════
  // HONEYWELL (Garrett) — TPE331 Turboprop
  // ════════════════════════════════════════════════════════════════════════════
  {id:'TPE331-1',      mfr:'Honeywell',model:'TPE331-1',     hp:575,  tbo:3500,type:'Turboprop',app:'Merlin IIA / Aero Commander'},
  {id:'TPE331-2',      mfr:'Honeywell',model:'TPE331-2',     hp:650,  tbo:3500,type:'Turboprop',app:'Merlin IIB / Thrush'},
  {id:'TPE331-5',      mfr:'Honeywell',model:'TPE331-5',     hp:717,  tbo:3500,type:'Turboprop',app:'Swearingen Merlin IVC'},
  {id:'TPE331-6',      mfr:'Honeywell',model:'TPE331-6',     hp:717,  tbo:3500,type:'Turboprop',app:'Cessna Conquest II C441'},
  {id:'TPE331-8',      mfr:'Honeywell',model:'TPE331-8',     hp:776,  tbo:3500,type:'Turboprop',app:'Merlin IV / Fairchild'},
  {id:'TPE331-10',     mfr:'Honeywell',model:'TPE331-10',    hp:940,  tbo:3500,type:'Turboprop',app:'Jetstream 31 / Metro III'},
  {id:'TPE331-10GT',   mfr:'Honeywell',model:'TPE331-10GT',  hp:940,  tbo:3500,type:'Turboprop',app:'Metro 23'},
  {id:'TPE331-10NA',   mfr:'Honeywell',model:'TPE331-10NA',  hp:940,  tbo:3500,type:'Turboprop',app:'CASA C-212-400'},
  {id:'TPE331-10R',    mfr:'Honeywell',model:'TPE331-10R',   hp:940,  tbo:3500,type:'Turboprop',app:'Metroliner III'},
  {id:'TPE331-10UA',   mfr:'Honeywell',model:'TPE331-10UA',  hp:940,  tbo:3500,type:'Turboprop',app:'Rockwell Turbo Commander'},
  {id:'TPE331-10UG',   mfr:'Honeywell',model:'TPE331-10UG',  hp:940,  tbo:3500,type:'Turboprop',app:'Turbo Commander 980'},
  {id:'TPE331-11U-612G',mfr:'Honeywell',model:'TPE331-11U',  hp:1000, tbo:3600,type:'Turboprop',app:'Jetstream 41 / Piper Cheyenne'},
  {id:'TPE331-12',     mfr:'Honeywell',model:'TPE331-12',    hp:1100, tbo:3600,type:'Turboprop',app:'Metro 23 / Merlin'},
  {id:'TPE331-12UA',   mfr:'Honeywell',model:'TPE331-12UA',  hp:1100, tbo:3600,type:'Turboprop',app:'Jetstream 41'},
  {id:'TPE331-14',     mfr:'Honeywell',model:'TPE331-14',    hp:1250, tbo:3600,type:'Turboprop',app:'C-27J Spartan'},
  {id:'TPE331-14GR/HR',mfr:'Honeywell',model:'TPE331-14GR/HR',hp:1250,tbo:3600,type:'Turboprop',app:'DHC-5 Buffalo'},

  // ════════════════════════════════════════════════════════════════════════════
  // ROLLS-ROYCE — 250 Series Turboshaft/Turboprop (Allison)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'250-B17C',      mfr:'Rolls-Royce',model:'250-B17C',   hp:400,  tbo:3500,type:'Turboprop',app:'Schweizer 333 helo'},
  {id:'250-B17F',      mfr:'Rolls-Royce',model:'250-B17F',   hp:450,  tbo:3500,type:'Turboprop',app:'Bell 206B JetRanger III'},
  {id:'250-C20B',      mfr:'Rolls-Royce',model:'250-C20B',   hp:420,  tbo:3500,type:'Turboprop',app:'Bell 206B / Agusta 109'},
  {id:'250-C20J',      mfr:'Rolls-Royce',model:'250-C20J',   hp:450,  tbo:3500,type:'Turboprop',app:'MD 500'},
  {id:'250-C20R',      mfr:'Rolls-Royce',model:'250-C20R',   hp:450,  tbo:3500,type:'Turboprop',app:'Bell 206B-3 / 206L'},
  {id:'250-C20W',      mfr:'Rolls-Royce',model:'250-C20W',   hp:450,  tbo:3500,type:'Turboprop',app:'Bell 206B3 mod'},
  {id:'250-C28B',      mfr:'Rolls-Royce',model:'250-C28B',   hp:650,  tbo:3500,type:'Turboprop',app:'Bell 212 / 214'},
  {id:'250-C28C',      mfr:'Rolls-Royce',model:'250-C28C',   hp:650,  tbo:3500,type:'Turboprop',app:'Agusta 119'},
  {id:'250-C47B',      mfr:'Rolls-Royce',model:'250-C47B',   hp:650,  tbo:3500,type:'Turboprop',app:'Bell 427 / MD Explorer'},
  {id:'250-C47M',      mfr:'Rolls-Royce',model:'250-C47M',   hp:725,  tbo:3500,type:'Turboprop',app:'Bell 427'},

  // ════════════════════════════════════════════════════════════════════════════
  // WILLIAMS / P&WC — Turbofan (VLJ / Light Jet)
  // ════════════════════════════════════════════════════════════════════════════
  {id:'FJ33-5A',       mfr:'Williams International',model:'FJ33-5A',hp:1846, tbo:4000,type:'Turbofan',app:'Cirrus SF50 Vision Jet'},
  {id:'PW615F-A',      mfr:'Pratt & Whitney Canada',model:'PW615F-A',  hp:1460, tbo:3500,type:'Turbofan',app:'Citation Mustang'},
  {id:'PW617F-E',      mfr:'Pratt & Whitney Canada',model:'PW617F-E',  hp:1695, tbo:3500,type:'Turbofan',app:'Embraer Phenom 100'},
  {id:'PW617F1-E',     mfr:'Pratt & Whitney Canada',model:'PW617F1-E', hp:1730, tbo:3500,type:'Turbofan',app:'Embraer Phenom 100EV'},
  {id:'PW610F-A',      mfr:'Pratt & Whitney Canada',model:'PW610F-A',  hp:950,  tbo:3000,type:'Turbofan',app:'Eclipse 500 / 550'},
  {id:'HF120',         mfr:'GE Honda',model:'HF120',                   hp:2095, tbo:5000,type:'Turbofan',app:'HondaJet HA-420'},
  {id:'PW535E1',       mfr:'Pratt & Whitney Canada',model:'PW535E1',   hp:3478, tbo:5000,type:'Turbofan',app:'Embraer Phenom 300E'},
  {id:'FJ44-1A',       mfr:'Williams International',model:'FJ44-1A',  hp:1900, tbo:5000,type:'Turbofan',app:'Citation CJ / SJ30'},
  {id:'FJ44-1AP',      mfr:'Williams International',model:'FJ44-1AP', hp:1965, tbo:5000,type:'Turbofan',app:'Citation CJ'},
  {id:'FJ44-2A',       mfr:'Williams International',model:'FJ44-2A',  hp:2400, tbo:5000,type:'Turbofan',app:'Citation CJ2 / Beechjet'},
  {id:'FJ44-2C',       mfr:'Williams International',model:'FJ44-2C',  hp:2490, tbo:5000,type:'Turbofan',app:'Citation CJ2+'},
  {id:'FJ44-3A',       mfr:'Williams International',model:'FJ44-3A',  hp:2820, tbo:5000,type:'Turbofan',app:'Citation CJ3'},
  {id:'FJ44-3A-24',    mfr:'Williams International',model:'FJ44-3A-24',hp:2820,tbo:5000,type:'Turbofan',app:'Citation CJ3+'},
  {id:'FJ44-4A',       mfr:'Williams International',model:'FJ44-4A',  hp:3600, tbo:5000,type:'Turbofan',app:'Citation CJ4'},
  {id:'FJ44-4A-QPM',   mfr:'Williams International',model:'FJ44-4A-QPM',hp:3600,tbo:5000,type:'Turbofan',app:'Citation CJ4 quiet pkg'},
  {id:'PW530A',        mfr:'Pratt & Whitney Canada',model:'PW530A',    hp:2887, tbo:5000,type:'Turbofan',app:'Citation Bravo'},
  {id:'PW535A',        mfr:'Pratt & Whitney Canada',model:'PW535A',    hp:3400, tbo:5000,type:'Turbofan',app:'Cessna Citation Bravo'},
  {id:'PW535E',        mfr:'Pratt & Whitney Canada',model:'PW535E',    hp:3400, tbo:5000,type:'Turbofan',app:'Learjet 60 / Embraer'},
  {id:'PW545A',        mfr:'Pratt & Whitney Canada',model:'PW545A',    hp:4119, tbo:5000,type:'Turbofan',app:'Cessna XLS+'},
  {id:'PW545D',        mfr:'Pratt & Whitney Canada',model:'PW545D',    hp:4119, tbo:5000,type:'Turbofan',app:'Citation XLS'},
  {id:'JT15D-1',       mfr:'Pratt & Whitney Canada',model:'JT15D-1',   hp:2200, tbo:5000,type:'Turbofan',app:'Citation I early'},
  {id:'JT15D-4',       mfr:'Pratt & Whitney Canada',model:'JT15D-4',   hp:2500, tbo:5000,type:'Turbofan',app:'Citation II'},
  {id:'JT15D-4B',      mfr:'Pratt & Whitney Canada',model:'JT15D-4B',  hp:2500, tbo:5000,type:'Turbofan',app:'Citation S/II'},
  {id:'JT15D-5',       mfr:'Pratt & Whitney Canada',model:'JT15D-5',   hp:2900, tbo:5000,type:'Turbofan',app:'Citation V / Bravo'},
  {id:'JT15D-5C',      mfr:'Pratt & Whitney Canada',model:'JT15D-5C',  hp:2900, tbo:5000,type:'Turbofan',app:'Citation V Ultra'},
  {id:'JT15D-5D',      mfr:'Pratt & Whitney Canada',model:'JT15D-5D',  hp:3190, tbo:5000,type:'Turbofan',app:'Citation Encore'},

  // ════════════════════════════════════════════════════════════════════════════
  // HONEYWELL — TFE731 Turbofan
  // ════════════════════════════════════════════════════════════════════════════
  {id:'TFE731-2',      mfr:'Honeywell',model:'TFE731-2',     hp:3500, tbo:5000,type:'Turbofan',app:'Learjet 35/36 / Falcon 10'},
  {id:'TFE731-2C',     mfr:'Honeywell',model:'TFE731-2C',    hp:3500, tbo:5000,type:'Turbofan',app:'Astra SP'},
  {id:'TFE731-3',      mfr:'Honeywell',model:'TFE731-3',     hp:3700, tbo:5000,type:'Turbofan',app:'Learjet 55 / Falcon 20'},
  {id:'TFE731-3R',     mfr:'Honeywell',model:'TFE731-3R',    hp:3700, tbo:5000,type:'Turbofan',app:'Learjet 55'},
  {id:'TFE731-4',      mfr:'Honeywell',model:'TFE731-4',     hp:4080, tbo:5000,type:'Turbofan',app:'Learjet 55C / Falcon 50'},
  {id:'TFE731-5',      mfr:'Honeywell',model:'TFE731-5',     hp:4500, tbo:5000,type:'Turbofan',app:'Citation V Ultra / Falcon 20'},
  {id:'TFE731-5AR',    mfr:'Honeywell',model:'TFE731-5AR',   hp:4500, tbo:5000,type:'Turbofan',app:'IA Astra SPX'},
  {id:'TFE731-5BR',    mfr:'Honeywell',model:'TFE731-5BR',   hp:4750, tbo:5000,type:'Turbofan',app:'Learjet 60'},
  {id:'TFE731-20',     mfr:'Honeywell',model:'TFE731-20',    hp:3500, tbo:5000,type:'Turbofan',app:'Learjet 40/45'},
  {id:'TFE731-20AR',   mfr:'Honeywell',model:'TFE731-20AR',  hp:3876, tbo:5000,type:'Turbofan',app:'Hawker 400XP'},
  {id:'TFE731-20BR',   mfr:'Honeywell',model:'TFE731-20BR',  hp:3876, tbo:5000,type:'Turbofan',app:'Hawker 400XP late'},
  {id:'TFE731-40',     mfr:'Honeywell',model:'TFE731-40',    hp:4250, tbo:5000,type:'Turbofan',app:'Hawker 800XP / 900XP'},
  {id:'TFE731-40AR',   mfr:'Honeywell',model:'TFE731-40AR',  hp:4250, tbo:5000,type:'Turbofan',app:'Hawker 900XP'},
  {id:'TFE731-60',     mfr:'Honeywell',model:'TFE731-60',    hp:5000, tbo:5000,type:'Turbofan',app:'Falcon 900 / Learjet 60'},

  // ════════════════════════════════════════════════════════════════════════════
  // MID / SUPER-MID / HEAVY — Turbofan
  // ════════════════════════════════════════════════════════════════════════════
  {id:'PW306D',        mfr:'Pratt & Whitney Canada',model:'PW306D',    hp:5907, tbo:6000,type:'Turbofan',app:'Citation Latitude'},
  {id:'PW306C',        mfr:'Pratt & Whitney Canada',model:'PW306C',    hp:5770, tbo:6000,type:'Turbofan',app:'Citation Sovereign'},
  {id:'PW307A',        mfr:'Pratt & Whitney Canada',model:'PW307A',    hp:6402, tbo:6000,type:'Turbofan',app:'Dassault Falcon 7X'},
  {id:'PW308C',        mfr:'Pratt & Whitney Canada',model:'PW308C',    hp:7000, tbo:6000,type:'Turbofan',app:'Falcon 2000EX / Hawker 4000'},
  {id:'AS907 (HTF7000)',mfr:'Honeywell',model:'HTF7000 / AS907',       hp:7000, tbo:6000,type:'Turbofan',app:'Challenger 300 / 350'},
  {id:'AE3007C',       mfr:'Rolls-Royce',model:'AE3007C',              hp:6442, tbo:6000,type:'Turbofan',app:'Cessna Citation X'},
  {id:'CF34-3B',       mfr:'General Electric',model:'CF34-3B',         hp:9220, tbo:6000,type:'Turbofan',app:'Challenger 604 / 605'},
  {id:'BR710A2-20',    mfr:'Rolls-Royce',model:'BR710',                hp:14750,tbo:8000,type:'Turbofan',app:'Gulfstream G550 / Global'},
  {id:'BR725A1-12',    mfr:'Rolls-Royce',model:'BR725',                hp:16900,tbo:8000,type:'Turbofan',app:'Gulfstream G650 / G650ER'},
  {id:'PW814GA',       mfr:'Pratt & Whitney Canada',model:'PW814GA',   hp:15144,tbo:8000,type:'Turbofan',app:'Gulfstream G500 / G600'},

  // ════════════════════════════════════════════════════════════════════════════
  // ROBINSON — Helicopter Piston
  // ════════════════════════════════════════════════════════════════════════════
  {id:'O-320-B2C (R22)',  mfr:'Lycoming',model:'O-320-B2C (R22)',  hp:145, tbo:2200,type:'Piston',app:'Robinson R22 Beta II'},
  {id:'O-540-F1B5 (R44)', mfr:'Lycoming',model:'O-540-F1B5 (R44)', hp:245, tbo:2200,type:'Piston',app:'Robinson R44 Raven I'},
  {id:'IO-540-AE1A5 (R44II)',mfr:'Lycoming',model:'IO-540-AE1A5 (R44 II)',hp:245,tbo:2200,type:'Piston',app:'Robinson R44 Raven II'},
  {id:'RR300 (R66)',      mfr:'Rolls-Royce',model:'RR300 (R66)',    hp:300, tbo:2400,type:'Turbine',app:'Robinson R66 Turbine'},

];
