import React, { FC, useEffect, useState } from 'react'
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Check from '@icons/check.svg';
import Language from '@icons/language_et.svg';
import Names from '@icons/name_et.svg';
import Calender from '@icons/calender_et.svg';
import Gender from '@icons/gender_et.svg';
import Household from '@icons/household_et.svg';
import Income from '@icons/income_et.svg';
import Savings from '@icons/savings_et.svg';
import Charcoal from '@icons/charcoal_et.svg';
import House from '@icons/house_et.svg';
import ID from '@icons/id_et.svg';
import CameraET from '@icons/camera_et.svg';
import Location from '@icons/location_et.svg';
import Cell from '@icons/cell_et.svg';
import Verbal from '@icons/verbal_et.svg';
import PenET from '@icons/pen_et.svg';

type Props = {
    header?: string;
}

const VerifyData: FC<Props> = ({ header }) => {
    const [image, setImage] = useState<string | null>(null);
    const [imageBack, setImageBack] = useState<string | null>(null);
    const [profile, setProfile] = useState<string | null>(null);
    const [contract, setContract] = useState<string | null>(null);
    const [waiver, setWaiver] = useState<string | null>(null);

    const loadImage = () => {
        const storedImage = localStorage.getItem('capturedIdFront');
        const storedImageBack = localStorage.getItem('capturedIdBack');
        const profileImg = localStorage.getItem('profilePicture');
        const contractImg = localStorage.getItem('capturedContract');
        const waiverImg = localStorage.getItem('capturedPolicy');
        if (storedImage && storedImageBack) {
            setImage(storedImage);
            setImageBack(storedImageBack);
            setProfile(profileImg);
            setContract(contractImg);
            setWaiver(waiverImg);
        }
    };

    useEffect(() => {
        loadImage();
    }, []);

    const storedLanguageJSON = localStorage.getItem('selectedLanguage');
    const storedNamesJSON = localStorage.getItem('storedNames');
    const storedDobJSON = localStorage.getItem('storedDob');
    const storedHouseholdJSON = localStorage.getItem('storedHousehold');

    const storedDayToJSON = localStorage.getItem('selectedDay');
    const storedMonthToJSON = localStorage.getItem('selectedMonth');
    const storedYearToJSON = localStorage.getItem('selectedYear');

    const storedGenderToJSON = localStorage.getItem('selectedGender');
    const storedStatusToJSON = localStorage.getItem('selectedStatus');
    const storedIncomeToJSON = localStorage.getItem('monthlyIncome');
    const storedSavingsToJSON = localStorage.getItem('monthlySavings');
    const storedCharcoalToJSON = localStorage.getItem('monthlyCharcoal');
    const storedCharcoalExToJSON = localStorage.getItem('monthlyCharcoalExpense');
    const storedUsageToJSON = localStorage.getItem('selectedUsage');
    const storedVillageToJSON = localStorage.getItem('selectedVillage');
    const storedLatToJSON = localStorage.getItem('latitude');
    const storedLongToJSON = localStorage.getItem('longitude');
    const storedCellToJSON = localStorage.getItem('phoneNumber');
    const storedVerbalToJSON = localStorage.getItem('selectedVerbalLanguage');
    const storedContractToJSON = localStorage.getItem('capturedContract');

    const EmptyTab = ({ children }: any) => {
        return (
            <>
                <div style={{
                    height: '46px', width: '300px',
                    backgroundColor: '#F0F0F0', borderRadius: '20px',
                    display: 'flex', justifyContent: 'left',
                    alignItems: 'center', margin: '10px'
                }} >{children}</div>
            </>
        )
    }

    return (
        <>
            <Header header={header} />
            <main style={{ top: '-60px', position: 'relative' }} >
                <IconText title='' Img={Check} imgSize={30} />
                <>
                    {/* Names */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Names />
                        </div>
                        <div>{storedNamesJSON}</div>
                    </EmptyTab>

                    {/* Dob */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Calender />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                            <div>{storedDayToJSON}</div>
                            <div>{storedMonthToJSON}</div>
                            <div>{storedYearToJSON}</div>
                        </div>
                    </EmptyTab>

                    {/* Gender */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Gender />
                        </div>
                        <div>
                            {storedGenderToJSON}
                        </div>
                    </EmptyTab>

                    {/* Household */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Household />
                        </div>
                        <div>
                            {storedHouseholdJSON} Household Members
                        </div>
                    </EmptyTab>

                    {/* Status */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Gender />
                        </div>
                        <div>
                            {storedStatusToJSON}
                        </div>
                    </EmptyTab>

                    {/* Monthly Income */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Income />
                        </div>
                        <div>
                            {storedIncomeToJSON} ZMK Monthly Income
                        </div>
                    </EmptyTab>

                    {/* Monthly Savings */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Savings />
                        </div>
                        <div>
                            {storedSavingsToJSON} ZMK Monthly Savings
                        </div>
                    </EmptyTab>

                    {/* Monthly Charcoal */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Charcoal />
                        </div>
                        <div>
                            {storedCharcoalToJSON}kg charcoal / monthly
                        </div>
                    </EmptyTab>

                    {/* Monthly Charcoal Expense */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <Savings />
                        </div>
                        <div style={{
                            position: 'relative',
                            left: '10px'
                        }} >
                            {storedCharcoalExToJSON} ZMK Monthly Char.Ex.
                        </div>
                    </EmptyTab>

                    {/* Home Stove Usage */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <House />
                        </div>
                        <div>
                            {storedUsageToJSON} Stove Usage
                        </div>
                    </EmptyTab>

                    {/* Identification */}
                    <div>
                        <div
                            style={{
                                height: '344px', width: '300px',
                                backgroundColor: '#F0F0F0', borderRadius: '20px',
                                display: 'flex', justifyContent: 'left',
                                alignItems: 'center', margin: '10px'
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        display: 'flex', justifyContent: 'center',
                                        alignItems: 'center', margin: '5px', position: 'relative',
                                        top: '-10px', left: '-60px'
                                    }}
                                >
                                    <ID />ID
                                </div>
                                <div style={{
                                    position: 'relative', left: '30px',
                                    top: '-10px', borderStyle: 'solid',
                                    borderColor: '#E0A714', borderRadius: '5px'
                                }} >
                                    <img width="190" height="126" src={image}
                                        style={{ borderRadius: '5px' }} alt="Stored Image" />
                                </div>
                                <div style={{
                                    position: 'relative', left: '30px',
                                    top: '-3px', borderStyle: 'solid',
                                    borderColor: '#E0A714', borderRadius: '5px'
                                }} >
                                    <img width="190" height="126" src={imageBack}
                                        style={{ borderRadius: '5px' }} alt="Stored Image" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Village */}
                    <EmptyTab>
                        <div style={{
                            display: 'flex', justifyContent: 'center',
                            alignItems: 'center', margin: '5px'
                        }} >
                            <House />
                        </div>
                        <div>
                            {storedVillageToJSON}
                        </div>
                    </EmptyTab>

                    {/* Profile Photo */}
                    <div>
                        <div
                            style={{
                                height: '344px', width: '300px',
                                backgroundColor: '#F0F0F0', borderRadius: '20px',
                                display: 'flex', justifyContent: 'left',
                                alignItems: 'center', margin: '10px'
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        display: 'flex', justifyContent: 'center',
                                        alignItems: 'center', margin: '5px', position: 'relative',
                                        top: '-40px', left: '-20px'
                                    }}
                                >
                                    <CameraET /> Profile Picture
                                </div>
                                <div>
                                    <div style={{
                                        position: 'relative', left: '30px',
                                        top: '-3px', borderStyle: 'solid',
                                        borderColor: '#E0A714', borderRadius: '5px'
                                    }} >
                                        <img width="190" height="190" src={profile}
                                            style={{ borderRadius: '5px' }} alt="Stored Image" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* coordinates */}
                    <EmptyTab>
                        <div
                            style={{
                                display: 'flex', justifyContent: 'center',
                                alignItems: 'center', margin: '5px'
                            }}
                        >
                            <Location />
                        </div>
                        <div>
                            Lat:{storedLatToJSON}
                        </div>
                        <div>
                            Lon:{storedLongToJSON}
                        </div>
                    </EmptyTab>

                    {/* language */}
                    <EmptyTab>
                        <div
                            style={{
                                display: 'flex', justifyContent: 'center',
                                alignItems: 'center', margin: '5px'
                            }}
                        >
                            <Language />
                        </div>
                        <div>
                            {storedLanguageJSON}
                        </div>
                    </EmptyTab>

                    {/* Cell number */}
                    <EmptyTab>
                        <div
                            style={{
                                display: 'flex', justifyContent: 'center',
                                alignItems: 'center', margin: '5px'
                            }}
                        >
                            <Cell />
                        </div>
                        <div>
                            {storedCellToJSON}
                        </div>
                    </EmptyTab>

                    {/* verbal language */}
                    <EmptyTab>
                        <div
                            style={{
                                display: 'flex', justifyContent: 'center',
                                alignItems: 'center', margin: '5px'
                            }}
                        >
                            <Verbal />
                        </div>
                        <div>
                            {storedVerbalToJSON}
                        </div>
                    </EmptyTab>

                    {/* contract */}
                    <div>
                        <div
                            style={{
                                height: '344px', width: '300px',
                                backgroundColor: '#F0F0F0', borderRadius: '20px',
                                display: 'flex', justifyContent: 'left',
                                alignItems: 'center', margin: '10px'
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        display: 'flex', justifyContent: 'center',
                                        alignItems: 'center', margin: '5px', position: 'relative',
                                        top: '-20px', left: '-20px'
                                    }}
                                >
                                    <PenET /> Contract
                                </div>
                                <div>
                                    <div style={{
                                        position: 'relative', left: '30px',
                                        top: '-3px', borderStyle: 'solid',
                                        borderColor: '#E0A714', borderRadius: '5px'
                                    }} >
                                        <img width="190" height="230" src={contract}
                                            style={{ borderRadius: '5px' }} alt="Stored Image" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* policy */}
                    <div>
                        <div
                            style={{
                                height: '344px', width: '300px',
                                backgroundColor: '#F0F0F0', borderRadius: '20px',
                                display: 'flex', justifyContent: 'left',
                                alignItems: 'center', margin: '10px'
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        display: 'flex', justifyContent: 'center',
                                        alignItems: 'center', margin: '5px', position: 'relative',
                                        top: '-20px', left: '-20px'
                                    }}
                                >
                                    <PenET /> Waiver
                                </div>
                                <div>
                                    <div style={{
                                        position: 'relative', left: '30px',
                                        top: '-3px', borderStyle: 'solid',
                                        borderColor: '#E0A714', borderRadius: '5px'
                                    }} >
                                        <img width="190" height="230" src={waiver}
                                            style={{ borderRadius: '5px' }} alt="Stored Image" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            </main>
        </>
    )
}

export default VerifyData
