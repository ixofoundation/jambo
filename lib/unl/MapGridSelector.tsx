import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';
import { ElementFactory, Question, Serializer, SvgRegistry } from 'survey-core';
import { ReactQuestionFactory, SurveyQuestionElementBase } from 'survey-react-ui';

import MapIcon from './MapIcon';
import UnlMap from './UnlMapClient';
import { CellPrecision, getFormattedCellDimensions } from './unl.service';

const CUSTOM_TYPE = 'map-grid-selector';

export type GridCell = {
  geoId: string;
  latitude: number;
  longitude: number;
  gridPrecision: CellPrecision;
  placeIdentifier?: string;
  placeName?: string;
  placeDistance?: string;
  postalAddressName?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  countyCode?: string;
  countyName?: string;
  cityName?: string;
  districtName?: string;
  subDistrictName?: string;
  blockName?: string;
  subBlockName?: string;
  roadName?: string;
  roadType?: string;
  postalCode?: string;
  houseName?: string;
  houseNumber?: string;
};

type SelectedCellsValue = GridCell | GridCell[] | null;

export class QuestionMapGridSelectorModel extends Question {
  getType() {
    return CUSTOM_TYPE;
  }

  public isEmpty(): boolean {
    const val = this.value;
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    return false;
  }

  get gridPrecision(): CellPrecision {
    return this.getPropertyValue('gridPrecision');
  }
  set gridPrecision(val: CellPrecision) {
    this.setPropertyValue('gridPrecision', val);
  }

  get center(): [number, number] {
    return this.getPropertyValue('center');
  }
  set center(val: [number, number]) {
    this.setPropertyValue('center', val);
  }

  get minZoom(): number {
    return this.getPropertyValue('minZoom');
  }
  set minZoom(val: number) {
    this.setPropertyValue('minZoom', val);
  }

  get maxZoom(): number {
    return this.getPropertyValue('maxZoom');
  }
  set maxZoom(val: number) {
    this.setPropertyValue('maxZoom', val);
  }

  get focusOnUser(): boolean {
    return this.getPropertyValue('focusOnUser');
  }
  set focusOnUser(val: boolean) {
    this.setPropertyValue('focusOnUser', val);
  }

  get allowMultiple(): boolean {
    return this.getPropertyValue('allowMultiple');
  }
  set allowMultiple(val: boolean) {
    this.setPropertyValue('allowMultiple', val);
  }

  get basemapToggle(): boolean {
    return this.getPropertyValue('basemapToggle');
  }
  set basemapToggle(val: boolean) {
    this.setPropertyValue('basemapToggle', val);
  }

  get autoPrecision(): boolean {
    return this.getPropertyValue('autoPrecision');
  }
  set autoPrecision(val: boolean) {
    this.setPropertyValue('autoPrecision', val);
  }

  get capturePlaceIdentifier(): boolean {
    return this.getPropertyValue('capturePlaceIdentifier');
  }
  set capturePlaceIdentifier(val: boolean) {
    this.setPropertyValue('capturePlaceIdentifier', val);
  }

  get capturePlaceName(): boolean {
    return this.getPropertyValue('capturePlaceName');
  }
  set capturePlaceName(val: boolean) {
    this.setPropertyValue('capturePlaceName', val);
  }

  get capturePlaceDistance(): boolean {
    return this.getPropertyValue('capturePlaceDistance');
  }
  set capturePlaceDistance(val: boolean) {
    this.setPropertyValue('capturePlaceDistance', val);
  }

  get capturePostalAddressName(): boolean {
    return this.getPropertyValue('capturePostalAddressName');
  }
  set capturePostalAddressName(val: boolean) {
    this.setPropertyValue('capturePostalAddressName', val);
  }

  get captureCountryCode(): boolean {
    return this.getPropertyValue('captureCountryCode');
  }
  set captureCountryCode(val: boolean) {
    this.setPropertyValue('captureCountryCode', val);
  }

  get captureCountryName(): boolean {
    return this.getPropertyValue('captureCountryName');
  }
  set captureCountryName(val: boolean) {
    this.setPropertyValue('captureCountryName', val);
  }

  get captureStateCode(): boolean {
    return this.getPropertyValue('captureStateCode');
  }
  set captureStateCode(val: boolean) {
    this.setPropertyValue('captureStateCode', val);
  }

  get captureStateName(): boolean {
    return this.getPropertyValue('captureStateName');
  }
  set captureStateName(val: boolean) {
    this.setPropertyValue('captureStateName', val);
  }

  get captureCountyCode(): boolean {
    return this.getPropertyValue('captureCountyCode');
  }
  set captureCountyCode(val: boolean) {
    this.setPropertyValue('captureCountyCode', val);
  }

  get captureCountyName(): boolean {
    return this.getPropertyValue('captureCountyName');
  }
  set captureCountyName(val: boolean) {
    this.setPropertyValue('captureCountyName', val);
  }

  get captureCityName(): boolean {
    return this.getPropertyValue('captureCityName');
  }
  set captureCityName(val: boolean) {
    this.setPropertyValue('captureCityName', val);
  }

  get captureDistrictName(): boolean {
    return this.getPropertyValue('captureDistrictName');
  }
  set captureDistrictName(val: boolean) {
    this.setPropertyValue('captureDistrictName', val);
  }

  get captureSubDistrictName(): boolean {
    return this.getPropertyValue('captureSubDistrictName');
  }
  set captureSubDistrictName(val: boolean) {
    this.setPropertyValue('captureSubDistrictName', val);
  }

  get captureBlockName(): boolean {
    return this.getPropertyValue('captureBlockName');
  }
  set captureBlockName(val: boolean) {
    this.setPropertyValue('captureBlockName', val);
  }

  get captureSubBlockName(): boolean {
    return this.getPropertyValue('captureSubBlockName');
  }
  set captureSubBlockName(val: boolean) {
    this.setPropertyValue('captureSubBlockName', val);
  }

  get captureRoadName(): boolean {
    return this.getPropertyValue('captureRoadName');
  }
  set captureRoadName(val: boolean) {
    this.setPropertyValue('captureRoadName', val);
  }

  get captureRoadType(): boolean {
    return this.getPropertyValue('captureRoadType');
  }
  set captureRoadType(val: boolean) {
    this.setPropertyValue('captureRoadType', val);
  }

  get capturePostalCode(): boolean {
    return this.getPropertyValue('capturePostalCode');
  }
  set capturePostalCode(val: boolean) {
    this.setPropertyValue('capturePostalCode', val);
  }

  get captureHouseName(): boolean {
    return this.getPropertyValue('captureHouseName');
  }
  set captureHouseName(val: boolean) {
    this.setPropertyValue('captureHouseName', val);
  }

  get captureHouseNumber(): boolean {
    return this.getPropertyValue('captureHouseNumber');
  }
  set captureHouseNumber(val: boolean) {
    this.setPropertyValue('captureHouseNumber', val);
  }
}

// `registerElement` signature expanded between survey-core versions; cast to any to
// stay compatible with both 1.9.x (2 args) and 2.x (3 args).
(ElementFactory.Instance as any).registerElement(
  CUSTOM_TYPE,
  (name: string) => new QuestionMapGridSelectorModel(name),
  true,
);

const svg = ReactDOMServer.renderToString(<MapIcon />);
SvgRegistry.registerIconFromSvg(CUSTOM_TYPE, svg);

// `registerCustomQuestion` was added in survey-core 2.x — guard so 1.9.x still works.
const factory = ElementFactory.Instance as any;
if (typeof factory.registerCustomQuestion === 'function') {
  factory.registerCustomQuestion(CUSTOM_TYPE);
}

export class SurveyQuestionMapGridSelector extends SurveyQuestionElementBase {
  constructor(props: any) {
    super(props);
    this.state = { value: this.question.value };
  }

  get question() {
    return this.questionBase as QuestionMapGridSelectorModel;
  }

  get value(): SelectedCellsValue {
    return this.question.value;
  }

  private createGridCellData(featureData: any): GridCell {
    const properties = featureData?.properties || {};
    const unlLocation = properties?.unl_location || {};
    const coordinates = featureData?.geometry?.coordinates || [0, 0];
    const postalAddress = (properties?.postal_address && properties.postal_address[0]) || {};

    const gridCell: GridCell = {
      geoId: unlLocation?.id || '',
      latitude: coordinates[1] || 0,
      longitude: coordinates[0] || 0,
      gridPrecision: this.question.gridPrecision,
    };

    if (this.question.capturePlaceIdentifier && properties?.place?.identifier) {
      gridCell.placeIdentifier = properties.place.identifier;
    }
    if (this.question.capturePlaceName && properties?.place?.name) {
      gridCell.placeName = properties.place.name;
    }
    if (this.question.capturePlaceDistance && properties?.place?.distance) {
      gridCell.placeDistance = properties.place.distance;
    }
    if (this.question.capturePostalAddressName && postalAddress?.name) {
      gridCell.postalAddressName = postalAddress.name;
    }
    if (this.question.captureCountryCode && postalAddress?.country?.country_code) {
      gridCell.countryCode = postalAddress.country.country_code;
    }
    if (this.question.captureCountryName && postalAddress?.country?.name) {
      gridCell.countryName = postalAddress.country.name;
    }
    if (this.question.captureStateCode && postalAddress?.state?.state_code) {
      gridCell.stateCode = postalAddress.state.state_code;
    }
    if (this.question.captureStateName && postalAddress?.state?.name) {
      gridCell.stateName = postalAddress.state.name;
    }
    if (this.question.captureCountyCode && postalAddress?.county?.county_code) {
      gridCell.countyCode = postalAddress.county.county_code;
    }
    if (this.question.captureCountyName && postalAddress?.county?.name) {
      gridCell.countyName = postalAddress.county.name;
    }
    if (this.question.captureCityName && postalAddress?.city?.name) {
      gridCell.cityName = postalAddress.city.name;
    }
    if (this.question.captureDistrictName && postalAddress?.district?.name) {
      gridCell.districtName = postalAddress.district.name;
    }
    if (this.question.captureSubDistrictName && postalAddress?.sub_district?.name) {
      gridCell.subDistrictName = postalAddress.sub_district.name;
    }
    if (this.question.captureBlockName && postalAddress?.block?.name) {
      gridCell.blockName = postalAddress.block.name;
    }
    if (this.question.captureSubBlockName && postalAddress?.sub_block?.name) {
      gridCell.subBlockName = postalAddress.sub_block.name;
    }
    if (this.question.captureRoadName && postalAddress?.road?.name) {
      gridCell.roadName = postalAddress.road.name;
    }
    if (this.question.captureRoadType && postalAddress?.road?.type) {
      gridCell.roadType = postalAddress.road.type;
    }
    if (this.question.capturePostalCode && postalAddress?.postal_code) {
      gridCell.postalCode = postalAddress.postal_code;
    }
    if (this.question.captureHouseName && postalAddress?.house?.name) {
      gridCell.houseName = postalAddress.house.name;
    }
    if (this.question.captureHouseNumber && postalAddress?.house?.number) {
      gridCell.houseNumber = postalAddress.house.number;
    }

    return gridCell;
  }

  private handleFeatureCollectionClick = (featureCollection: any) => {
    if (!featureCollection?.features?.length) return;

    const feature = featureCollection.features[0];
    const newCell = this.createGridCellData(feature);
    if (!newCell.geoId) return;

    let newValue: SelectedCellsValue;
    if (this.question.allowMultiple) {
      const currentCells = Array.isArray(this.value) ? this.value : this.value ? [this.value] : [];
      const existingIndex = currentCells.findIndex((cell) => cell.geoId === newCell.geoId);
      const updatedCells =
        existingIndex >= 0
          ? currentCells.filter((_, index) => index !== existingIndex)
          : [...currentCells, newCell];
      newValue = updatedCells.length > 0 ? updatedCells : null;
    } else {
      const isSameCell =
        this.value && !Array.isArray(this.value) && (this.value as GridCell).geoId === newCell.geoId;
      newValue = isSameCell ? null : newCell;
    }

    this.question.value = newValue;
    this.forceUpdate();
  };

  get style(): React.CSSProperties {
    const baseStyle: React.CSSProperties = {
      border: '1px solid var(--sjs-border-default, #e0e0e0)',
      borderRadius: 'var(--sjs-questionpanel-cornerRadius, 8px)',
      position: 'relative',
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      boxSizing: 'border-box',
    };
    if (this.question.getPropertyValue('readOnly') || (this.question as any).isDesignMode) {
      return { ...baseStyle, pointerEvents: 'none', opacity: 0.7 };
    }
    return baseStyle;
  }

  private renderSelectedCellsSummary(): React.ReactNode {
    if (!this.value) return null;
    const cells = Array.isArray(this.value) ? this.value : [this.value];
    if (cells.length === 0) return null;

    return (
      <div
        style={{
          marginTop: 12,
          padding: '8px 12px',
          backgroundColor: 'var(--sjs-general-backcolor-dim-light, var(--bg-secondary, #f4f4f4))',
          borderRadius: 4,
          fontSize: 14,
          color: 'var(--sjs-general-forecolor, var(--text-primary, #222))',
        }}
      >
        <strong>Selected:</strong> {cells.length} cell{cells.length !== 1 ? 's' : ''}
        {cells.length <= 3 &&
          cells.map((cell, index) => (
            <div key={cell.geoId} style={{ fontSize: 12, marginTop: 4 }}>
              <div>
                <strong>
                  {index + 1}. {cell.geoId}
                </strong>{' '}
                ({cell.latitude.toFixed(6)}, {cell.longitude.toFixed(6)})
              </div>
              {this.renderCapturedFieldsForCell(cell)}
            </div>
          ))}
      </div>
    );
  }

  private renderCapturedFieldsForCell(cell: GridCell): React.ReactNode {
    const capturedFields: React.ReactNode[] = [];
    if (this.question.capturePlaceName && cell.placeName) {
      capturedFields.push(<div key="placeName">Place: {cell.placeName}</div>);
    }
    if (this.question.captureCountryName && cell.countryName) {
      capturedFields.push(<div key="countryName">Country: {cell.countryName}</div>);
    }
    if (this.question.captureStateName && cell.stateName) {
      capturedFields.push(<div key="stateName">State: {cell.stateName}</div>);
    }
    if (this.question.captureCountyName && cell.countyName) {
      capturedFields.push(<div key="countyName">County: {cell.countyName}</div>);
    }
    if (this.question.captureCityName && cell.cityName) {
      capturedFields.push(<div key="cityName">City: {cell.cityName}</div>);
    }
    if (this.question.captureDistrictName && cell.districtName) {
      capturedFields.push(<div key="districtName">District: {cell.districtName}</div>);
    }
    if (this.question.captureRoadName && cell.roadName) {
      capturedFields.push(<div key="roadName">Road: {cell.roadName}</div>);
    }
    if (this.question.capturePostalCode && cell.postalCode) {
      capturedFields.push(<div key="postalCode">Postal Code: {cell.postalCode}</div>);
    }
    if (this.question.captureHouseNumber && cell.houseNumber) {
      capturedFields.push(<div key="houseNumber">House Number: {cell.houseNumber}</div>);
    }
    if (capturedFields.length === 0) return null;
    return (
      <div style={{ marginLeft: 8, color: 'var(--text-primary, #555)', fontSize: 11 }}>{capturedFields}</div>
    );
  }

  renderElement() {
    return (
      <div style={this.style}>
        <UnlMap
          precision={this.question.gridPrecision}
          focusOnUser={this.question.focusOnUser}
          center={this.question.center}
          getFeatureCollectionOnClick={this.handleFeatureCollectionClick}
          mapId={`map-${this.question.name || 'default'}`}
        />
        {this.renderSelectedCellsSummary()}

        <div
          style={{
            marginTop: 12,
            padding: '0 12px 12px',
            fontSize: 12,
            color: 'var(--sjs-general-forecolor-light, var(--text-primary, #555))',
            textAlign: 'center',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {this.question.focusOnUser && 'Zoom to your location and '}
          {this.question.gridPrecision && `Current precision: ${this.question.gridPrecision}. `}
          Click on a grid cell to select{this.question.allowMultiple ? ' (multiple selections allowed)' : ''}
        </div>
      </div>
    );
  }
}

Serializer.addClass(
  CUSTOM_TYPE,
  [
    {
      name: 'gridPrecision:dropdown',
      default: CellPrecision.GEOHASH_LENGTH_7,
      choices: Object.values(CellPrecision)
        .filter((value) => typeof value === 'number')
        .map((precision) => ({
          value: precision,
          text: getFormattedCellDimensions(precision as CellPrecision),
        })),
      category: 'general',
      visibleIndex: 2,
    },
    { name: 'center', default: [0, 0], category: 'general', visibleIndex: 3 },
    { name: 'minZoom:number', default: 0, minValue: 0, maxValue: 24, category: 'general', visibleIndex: 4 },
    { name: 'maxZoom:number', default: 22, minValue: 0, maxValue: 24, category: 'general', visibleIndex: 5 },
    { name: 'focusOnUser:boolean', default: true, category: 'general', visibleIndex: 6 },
    { name: 'allowMultiple:boolean', default: false, category: 'general', visibleIndex: 8 },
    { name: 'basemapToggle:boolean', default: true, category: 'appearance', visibleIndex: 1 },
    { name: 'autoPrecision:boolean', default: false, category: 'advanced', visibleIndex: 1 },
    { name: 'capturePlaceIdentifier:boolean', default: true, category: 'dataCapture', visibleIndex: 1 },
    { name: 'capturePlaceName:boolean', default: true, category: 'dataCapture', visibleIndex: 2 },
    { name: 'capturePlaceDistance:boolean', default: true, category: 'dataCapture', visibleIndex: 3 },
    { name: 'capturePostalAddressName:boolean', default: true, category: 'dataCapture', visibleIndex: 4 },
    { name: 'captureCountryCode:boolean', default: true, category: 'dataCapture', visibleIndex: 5 },
    { name: 'captureCountryName:boolean', default: true, category: 'dataCapture', visibleIndex: 6 },
    { name: 'captureStateCode:boolean', default: true, category: 'dataCapture', visibleIndex: 7 },
    { name: 'captureStateName:boolean', default: true, category: 'dataCapture', visibleIndex: 8 },
    { name: 'captureCountyCode:boolean', default: true, category: 'dataCapture', visibleIndex: 9 },
    { name: 'captureCountyName:boolean', default: true, category: 'dataCapture', visibleIndex: 10 },
    { name: 'captureCityName:boolean', default: true, category: 'dataCapture', visibleIndex: 11 },
    { name: 'captureDistrictName:boolean', default: true, category: 'dataCapture', visibleIndex: 12 },
    { name: 'captureSubDistrictName:boolean', default: true, category: 'dataCapture', visibleIndex: 13 },
    { name: 'captureBlockName:boolean', default: true, category: 'dataCapture', visibleIndex: 14 },
    { name: 'captureSubBlockName:boolean', default: true, category: 'dataCapture', visibleIndex: 15 },
    { name: 'captureRoadName:boolean', default: true, category: 'dataCapture', visibleIndex: 16 },
    { name: 'captureRoadType:boolean', default: true, category: 'dataCapture', visibleIndex: 17 },
    { name: 'capturePostalCode:boolean', default: true, category: 'dataCapture', visibleIndex: 18 },
    { name: 'captureHouseName:boolean', default: true, category: 'dataCapture', visibleIndex: 19 },
    { name: 'captureHouseNumber:boolean', default: true, category: 'dataCapture', visibleIndex: 20 },
  ],
  function () {
    return new QuestionMapGridSelectorModel('');
  },
  'question',
);

ReactQuestionFactory.Instance.registerQuestion(CUSTOM_TYPE, (props: any) =>
  createElement(SurveyQuestionMapGridSelector as any, props),
);

export { CUSTOM_TYPE };
