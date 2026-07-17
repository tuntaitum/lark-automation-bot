export async function getCompanyInfo(juristicId) {
  const response = await fetch(`https://openapi.dbd.go.th/api/v1/juristic_person/${juristicId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (data.status?.code !== '1000') {
    throw new Error(`DBD API error: ${data.status?.description}`);
  }

  const company = data.data?.[0]?.['cd:OrganizationJuristicPerson'];
  if (!company) throw new Error('No company data found');

  // extract address
  const addr = company['cd:OrganizationJuristicAddress']?.['cr:AddressType'];
  const road = addr?.['cd:Road'] ? `ถนน${addr['cd:Road']}` : '';
  const subdistrict = addr?.['cd:CitySubDivision']?.['cr:CitySubDivisionTextTH'] || '';
  const district = addr?.['cd:City']?.['cr:CityTextTH'] || '';
  const province = addr?.['cd:CountrySubDivision']?.['cr:CountrySubDivisionTextTH'] || '';
  const addressNo = addr?.['cd:AddressNo'] || '';
  const building = addr?.['cd:Building'] ? `อาคาร${addr['cd:Building']}` : '';
  const fullAddress = [addressNo, building, road, subdistrict, district, province].filter(Boolean).join(' ');

  // extract objective
  const objective = company['cd:OrganizationJuristicObjective']?.['td:JuristicObjective'];
  const objectiveText = objective?.['td:JuristicObjectiveTextTH'] || '-';

  // format register date from YYYYMMDD to readable
  const rawDate = company['cd:OrganizationJuristicRegisterDate'] || '';
  const registerDate = rawDate.length === 8
    ? `${rawDate.slice(6,8)}/${rawDate.slice(4,6)}/${rawDate.slice(0,4)}`
    : rawDate;

  // format capital with commas
  const capital = company['cd:OrganizationJuristicRegisterCapital']
    ? parseFloat(company['cd:OrganizationJuristicRegisterCapital']).toLocaleString('th-TH', { maximumFractionDigits: 0 })
    : '-';

  return {
    juristicId: company['cd:OrganizationJuristicID'],
    nameTH: company['cd:OrganizationJuristicNameTH'],
    nameEN: company['cd:OrganizationJuristicNameEN'],
    type: company['cd:OrganizationJuristicType'],
    status: company['cd:OrganizationJuristicStatus'],
    registerDate,
    capital,
    objective: objectiveText,
    address: fullAddress,
    branch: company['cd:OrganizationJuristicBranchName'] || '-',
  };
}

export function formatCompanyInfo(info) {
  return [
    `🏢 *${info.nameTH}*`,
    `    ${info.nameEN}`,
    '',
    `📋 เลขทะเบียน: ${info.juristicId}`,
    `🏗 ประเภท: ${info.type}`,
    `📊 สถานะ: ${info.status}`,
    `📅 จดทะเบียน: ${info.registerDate}`,
    `💰 ทุนจดทะเบียน: ${info.capital} บาท`,
    `🏭 วัตถุประสงค์: ${info.objective}`,
    `📍 ที่ตั้ง: ${info.address}`,
  ].join('\n');
}