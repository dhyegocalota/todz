import { COMPANY, LANGUAGE_PROFILES, Language, REPOSITORY } from '@todz/types';
import { LANDING_COPY_BY_LANGUAGE } from './landing-copy';
import { landingFeatureListOf } from './landing-lines';
import { publicPathOf } from './language-paths';
import { scriptJson } from './site-constants';
import { OPEN_GRAPH_IMAGE } from './site-icons';
import { DOCS_URL, DOWNLOAD_URL, LANDING_PATH, SITE_URL } from './site-urls';

const SCHEMA_URL = 'https://schema.org';
const OPERATING_SYSTEM = 'macOS 14 or later';
const APPLICATION_CATEGORY = 'BusinessApplication';
const APPLICATION_SUB_CATEGORY = 'Productivity';
const FREE_PRICE = '0';
const PRICE_CURRENCY = 'USD';
const IN_STOCK_AVAILABILITY = `${SCHEMA_URL}/InStock`;

enum SchemaType {
  Organization = 'Organization',
  WebSite = 'WebSite',
  SoftwareApplication = 'SoftwareApplication',
  Offer = 'Offer',
}

const ORGANIZATION_ID = `${SITE_URL}/#publisher`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APPLICATION_ID = `${SITE_URL}/#app`;
const PUBLISHER = { '@id': ORGANIZATION_ID };

const ORGANIZATION = {
  '@type': SchemaType.Organization,
  '@id': ORGANIZATION_ID,
  name: COMPANY.tradeName,
  legalName: COMPANY.legalName,
  url: COMPANY.website,
  logo: COMPANY.logo,
};

function websiteOf({ language, homeUrl }: { language: Language; homeUrl: string }): object {
  return {
    '@type': SchemaType.WebSite,
    '@id': WEBSITE_ID,
    name: LANDING_COPY_BY_LANGUAGE[language].meta.siteName,
    url: homeUrl,
    inLanguage: LANGUAGE_PROFILES[language].htmlLang,
    publisher: PUBLISHER,
  };
}

function applicationOf({ language, homeUrl }: { language: Language; homeUrl: string }): object {
  const { meta } = LANDING_COPY_BY_LANGUAGE[language];
  return {
    '@type': SchemaType.SoftwareApplication,
    '@id': APPLICATION_ID,
    name: meta.siteName,
    description: meta.description,
    url: homeUrl,
    image: `${SITE_URL}${OPEN_GRAPH_IMAGE.path}`,
    operatingSystem: OPERATING_SYSTEM,
    applicationCategory: APPLICATION_CATEGORY,
    applicationSubCategory: APPLICATION_SUB_CATEGORY,
    featureList: landingFeatureListOf({ language }),
    publisher: PUBLISHER,
    codeRepository: REPOSITORY.url,
    license: REPOSITORY.licenseSpdxUrl,
    downloadUrl: DOWNLOAD_URL,
    sameAs: [REPOSITORY.url, DOCS_URL],
    offers: {
      '@type': SchemaType.Offer,
      price: FREE_PRICE,
      priceCurrency: PRICE_CURRENCY,
      availability: IN_STOCK_AVAILABILITY,
      url: DOWNLOAD_URL,
    },
  };
}

export function landingStructuredDataOf({ language }: { language: Language }): string {
  const homeUrl = `${SITE_URL}${publicPathOf({ language, path: LANDING_PATH })}`;
  return scriptJson({
    '@context': SCHEMA_URL,
    '@graph': [ORGANIZATION, websiteOf({ language, homeUrl }), applicationOf({ language, homeUrl })],
  });
}

export const LANDING_STRUCTURED_DATA_BY_LANGUAGE = Object.fromEntries(
  Object.values(Language).map((language) => [language, landingStructuredDataOf({ language })]),
) as Record<Language, string>;

export const LANDING_STRUCTURED_DATA = LANDING_STRUCTURED_DATA_BY_LANGUAGE[Language.English];
