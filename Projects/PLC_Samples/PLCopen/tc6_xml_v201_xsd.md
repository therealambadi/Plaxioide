Schema TC6_XML_V201.xsd

schema location:
attribute form default:
element form default:
targetNamespace:

Elements
project

http://www.plcopen.org/tc6_xml/tc6_xml_v201.xsd
unqualified
qualified
http://www.plcopen.org/xml/tc6_0201

Groups
commonObjects
derivedTypes

Complex types
addData
addDataInfo

Simple types
accessType
edgeModifierType

elementaryTypes

body

pouType

extended

connection

storageModifierType

fbdObjects

connectionPointIn

ldObjects

connectionPointOut

sfcObjects

dataType
formattedText
position
pouInstance
rangeSigned
rangeUnsigned
value
varList
varListAccess
varListConfig
varListPlain

element project
diagram

namespace
properties
children
annotation

http://www.plcopen.org/xml/tc6_0201
content

complex

ppx:fileHeader ppx:contentHeader ppx:types ppx:instances ppx:addData ppx:documentation
documentation
The complete project

source

<xsd:element name="project">
<xsd:annotation>
<xsd:documentation>The complete project</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="fileHeader">
<xsd:complexType>
<xsd:attribute name="companyName" type="xsd:string" use="required"/>
<xsd:attribute name="companyURL" type="xsd:anyURI" use="optional"/>
<xsd:attribute name="productName" type="xsd:string" use="required"/>
<xsd:attribute name="productVersion" type="xsd:string" use="required"/>
<xsd:attribute name="productRelease" type="xsd:string" use="optional"/>
<xsd:attribute name="creationDateTime" type="xsd:dateTime" use="required"/>
<xsd:attribute name="contentDescription" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="contentHeader">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="Comment" type="xsd:string" minOccurs="0"/>
<xsd:element name="coordinateInfo">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="pageSize" minOccurs="0">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="fbd">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="ld">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="sfc">

<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="addDataInfo" type="ppx:addDataInfo" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="version" type="xsd:string" use="optional"/>
<xsd:attribute name="modificationDateTime" type="xsd:dateTime" use="optional"/>
<xsd:attribute name="organization" type="xsd:string" use="optional"/>
<xsd:attribute name="author" type="xsd:string" use="optional"/>
<xsd:attribute name="language" type="xsd:language" use="optional">
<xsd:annotation>
<xsd:documentation>Documentation language of the project e.g. "enUS"</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
</xsd:complexType>
</xsd:element>
<xsd:element name="types">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="dataTypes">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="dataType" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="baseType" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="pous">

<xsd:complexType>
<xsd:sequence>
<xsd:element name="pou" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="interface" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="returnType" type="ppx:dataType" minOccurs="0"/>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:element name="localVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="tempVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="externalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>

</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="accessVars" type="ppx:varList"/>
</xsd:choice>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="actions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText"
minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="transitions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="transition" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText"
minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="body" type="ppx:body" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="pouType" type="ppx:pouType" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="instances">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="configurations">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="configuration" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of resources and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="resource" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of programs and tasks and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="task" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a periodic or triggered
task</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

<xsd:element name="documentation" type="ppx:formattedText"
minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="single" type="xsd:string" use="optional"/>
<xsd:attribute name="interval" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>Vendor specific: Either a constant duration as defined
in the IEC or variable name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="priority" use="required">
<xsd:simpleType>
<xsd:restriction base="xsd:integer">
<xsd:minInclusive value="0"/>
<xsd:maxInclusive value="65535"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="accessVars" type="ppx:varListAccess" minOccurs="0"/>
<xsd:element name="configVars" type="ppx:varListConfig" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/fileHeader
diagram

namespace
properties
attributes

source

http://www.plcopen.org/xml/tc6_0201
isRef 0
content complex
Name
companyName

Type
xsd:string

Use
required

companyURL

xsd:anyURI

optional

productName

xsd:string

required

productVersion

xsd:string

required

productRelease

xsd:string

optional

creationDateTime

xsd:dateTime

required

contentDescription

xsd:string

optional

Default

Fixed

<xsd:element name="fileHeader">
<xsd:complexType>
<xsd:attribute name="companyName" type="xsd:string" use="required"/>
<xsd:attribute name="companyURL" type="xsd:anyURI" use="optional"/>
<xsd:attribute name="productName" type="xsd:string" use="required"/>

annotation

<xsd:attribute name="productVersion" type="xsd:string" use="required"/>
<xsd:attribute name="productRelease" type="xsd:string" use="optional"/>
<xsd:attribute name="creationDateTime" type="xsd:dateTime" use="required"/>
<xsd:attribute name="contentDescription" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute project/fileHeader/@companyName
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="companyName" type="xsd:string" use="required"/>

attribute project/fileHeader/@companyURL
type
properties
source

xsd:anyURI
isRef
use

0
optional

<xsd:attribute name="companyURL" type="xsd:anyURI" use="optional"/>

attribute project/fileHeader/@productName
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="productName" type="xsd:string" use="required"/>

attribute project/fileHeader/@productVersion
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="productVersion" type="xsd:string" use="required"/>

attribute project/fileHeader/@productRelease
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="productRelease" type="xsd:string" use="optional"/>

attribute project/fileHeader/@creationDateTime
type
properties
source

xsd:dateTime
isRef
use

0
required

<xsd:attribute name="creationDateTime" type="xsd:dateTime" use="required"/>

attribute project/fileHeader/@contentDescription
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="contentDescription" type="xsd:string" use="optional"/>

element project/contentHeader
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:Comment ppx:coordinateInfo ppx:addDataInfo ppx:addData

attributes

Name
name

Type
xsd:string

Use
required

version

xsd:string

optional

modificationDateTime

xsd:dateTime

optional

organization

xsd:string

optional

author

xsd:string

optional

language

xsd:language

optional

source

<xsd:element name="contentHeader">
<xsd:complexType>
<xsd:sequence>

Default

Fixed

annotation

documentation
Documentation
language of
the project e.g.
"en-US"

<xsd:element name="Comment" type="xsd:string" minOccurs="0"/>
<xsd:element name="coordinateInfo">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="pageSize" minOccurs="0">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="fbd">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="ld">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="sfc">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="addDataInfo" type="ppx:addDataInfo" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="version" type="xsd:string" use="optional"/>
<xsd:attribute name="modificationDateTime" type="xsd:dateTime" use="optional"/>
<xsd:attribute name="organization" type="xsd:string" use="optional"/>

<xsd:attribute name="author" type="xsd:string" use="optional"/>
<xsd:attribute name="language" type="xsd:language" use="optional">
<xsd:annotation>
<xsd:documentation>Documentation language of the project e.g. "enUS"</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
</xsd:complexType>
</xsd:element>

attribute project/contentHeader/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute project/contentHeader/@version
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="version" type="xsd:string" use="optional"/>

attribute project/contentHeader/@modificationDateTime
type
properties
source

xsd:dateTime
isRef
use

0
optional

<xsd:attribute name="modificationDateTime" type="xsd:dateTime" use="optional"/>

attribute project/contentHeader/@organization
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="organization" type="xsd:string" use="optional"/>

attribute project/contentHeader/@author
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="author" type="xsd:string" use="optional"/>

attribute project/contentHeader/@language
type

xsd:language

properties
annotation
source

isRef 0
use optional
documentation
Documentation language of the project e.g. "en-US"

<xsd:attribute name="language" type="xsd:language" use="optional">
<xsd:annotation>
<xsd:documentation>Documentation language of the project e.g. "en-US"</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

element project/contentHeader/Comment
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

xsd:string

properties

isRef
minOcc
maxOcc
content

source

0
0
1
simple

<xsd:element name="Comment" type="xsd:string" minOccurs="0"/>

element project/contentHeader/coordinateInfo
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:pageSize ppx:fbd ppx:ld ppx:sfc

source

<xsd:element name="coordinateInfo">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="pageSize" minOccurs="0">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="fbd">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>

<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="ld">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="sfc">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/contentHeader/coordinateInfo/pageSize
diagram

namespace
properties

attributes

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content
Name
x
y

source

0
0
1
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="pageSize" minOccurs="0">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>

Fixed

annotation

</xsd:complexType>
</xsd:element>

attribute project/contentHeader/coordinateInfo/pageSize/@x
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="x" type="xsd:decimal" use="required"/>

attribute project/contentHeader/coordinateInfo/pageSize/@y
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="y" type="xsd:decimal" use="required"/>

element project/contentHeader/coordinateInfo/fbd
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

0
complex

children

ppx:scaling

source

<xsd:element name="fbd">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/contentHeader/coordinateInfo/fbd/scaling
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef

0

attributes

content
Name
x

complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>

attribute project/contentHeader/coordinateInfo/fbd/scaling/@x
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="x" type="xsd:decimal" use="required"/>

attribute project/contentHeader/coordinateInfo/fbd/scaling/@y
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="y" type="xsd:decimal" use="required"/>

element project/contentHeader/coordinateInfo/ld
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

0
complex

children

ppx:scaling

source

<xsd:element name="ld">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

Fixed

annotation

element project/contentHeader/coordinateInfo/ld/scaling
diagram

namespace
properties
attributes

http://www.plcopen.org/xml/tc6_0201
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>

attribute project/contentHeader/coordinateInfo/ld/scaling/@x
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="x" type="xsd:decimal" use="required"/>

attribute project/contentHeader/coordinateInfo/ld/scaling/@y
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="y" type="xsd:decimal" use="required"/>

element project/contentHeader/coordinateInfo/sfc
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

0
complex

children

ppx:scaling

source

<xsd:element name="sfc">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>

Fixed

annotation

</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/contentHeader/coordinateInfo/sfc/scaling
diagram

namespace
properties
attributes

http://www.plcopen.org/xml/tc6_0201
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="scaling">
<xsd:complexType>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>
</xsd:element>

attribute project/contentHeader/coordinateInfo/sfc/scaling/@x
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="x" type="xsd:decimal" use="required"/>

attribute project/contentHeader/coordinateInfo/sfc/scaling/@y
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="y" type="xsd:decimal" use="required"/>

element project/contentHeader/addDataInfo
diagram

Fixed

annotation

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addDataInfo

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:info

source

<xsd:element name="addDataInfo" type="ppx:addDataInfo" minOccurs="0"/>

element project/contentHeader/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/types
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:dataTypes ppx:pous

source

<xsd:element name="types">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="dataTypes">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="dataType" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="baseType" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">

<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="pous">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="pou" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="interface" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="returnType" type="ppx:dataType" minOccurs="0"/>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:element name="localVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="tempVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>

</xsd:complexType>
</xsd:element>
<xsd:element name="externalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="accessVars" type="ppx:varList"/>
</xsd:choice>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="actions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="transitions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="transition" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>

<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="body" type="ppx:body" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="pouType" type="ppx:pouType" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/types/dataTypes
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:dataType

source

<xsd:element name="dataTypes">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="dataType" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>

<xsd:element name="baseType" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/types/dataTypes/dataType
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:baseType ppx:initialValue ppx:addData ppx:documentation

attributes

Name
name

source

Type
xsd:string

Use
required

Default

Fixed

annotation

<xsd:element name="dataType" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="baseType" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>

<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>

attribute project/types/dataTypes/dataType/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

element project/types/dataTypes/dataType/baseType
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="baseType" type="ppx:dataType"/>

element project/types/dataTypes/dataType/initialValue
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:value

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:simpleValue ppx:arrayValue ppx:structValue

source

<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>

element project/types/dataTypes/dataType/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/types/dataTypes/dataType/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/types/pous
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

0
complex

children

ppx:pou

source

<xsd:element name="pous">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="pou" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="interface" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="returnType" type="ppx:dataType" minOccurs="0"/>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:element name="localVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="tempVars">
<xsd:complexType>
<xsd:complexContent>

<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="externalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="accessVars" type="ppx:varList"/>
</xsd:choice>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="actions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>

<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="transitions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="transition" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="body" type="ppx:body" minOccurs="0" maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="pouType" type="ppx:pouType" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>

</xsd:element>

element project/types/pous/pou
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:interface ppx:actions ppx:transitions ppx:body ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

pouType

ppx:pouType

required

globalId

xsd:ID

optional

source

Default

Fixed

<xsd:element name="pou" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="interface" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="returnType" type="ppx:dataType" minOccurs="0"/>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:element name="localVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

annotation

<xsd:element name="tempVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="externalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="accessVars" type="ppx:varList"/>
</xsd:choice>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="actions" minOccurs="0">
<xsd:complexType>

<xsd:sequence>
<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="transitions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="transition" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="body" type="ppx:body" minOccurs="0" maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="pouType" type="ppx:pouType" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute project/types/pous/pou/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute project/types/pous/pou/@pouType
type
properties
facets

source

ppx:pouType
isRef 0
use required
enumeration function
enumeration functionBlock
enumeration program

<xsd:attribute name="pouType" type="ppx:pouType" use="required"/>

attribute project/types/pous/pou/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element project/types/pous/pou/interface
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:returnType ppx:localVars ppx:tempVars ppx:inputVars ppx:outputVars ppx:inOutVars ppx:externalVars
ppx:globalVars ppx:accessVars ppx:addData ppx:documentation

source

<xsd:element name="interface" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="returnType" type="ppx:dataType" minOccurs="0"/>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:element name="localVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="tempVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inputVars">
<xsd:complexType>

<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="externalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="accessVars" type="ppx:varList"/>
</xsd:choice>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/types/pous/pou/interface/returnType
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="returnType" type="ppx:dataType" minOccurs="0"/>

element project/types/pous/pou/interface/localVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

Fixed

annotation

source

<xsd:element name="localVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

element project/types/pous/pou/interface/tempVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

<xsd:element name="tempVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>

Fixed

annotation

</xsd:complexType>
</xsd:element>

element project/types/pous/pou/interface/inputVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

<xsd:element name="inputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

Fixed

annotation

element project/types/pous/pou/interface/outputVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

<xsd:element name="outputVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

Fixed

annotation

element project/types/pous/pou/interface/inOutVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

<xsd:element name="inOutVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

Fixed

annotation

element project/types/pous/pou/interface/externalVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

<xsd:element name="externalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

Fixed

annotation

element project/types/pous/pou/interface/globalVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

<xsd:element name="globalVars">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:varList"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

Fixed

annotation

element project/types/pous/pou/interface/accessVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:varList
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

<xsd:element name="accessVars" type="ppx:varList"/>

element project/types/pous/pou/interface/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

Fixed

annotation

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/types/pous/pou/interface/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/types/pous/pou/actions
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:action

source

<xsd:element name="actions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>

</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/types/pous/pou/actions/action
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:body ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute project/types/pous/pou/actions/action/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute project/types/pous/pou/actions/action/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element project/types/pous/pou/actions/action/body
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:body

properties

isRef
content

0
complex

children

ppx:IL ppx:ST ppx:FBD ppx:LD ppx:SFC ppx:addData ppx:documentation

attributes

Name
WorksheetName

Type
xsd:string

Use
optional

globalId

xsd:ID

optional

Default

Fixed

annotation

source

<xsd:element name="body" type="ppx:body"/>

element project/types/pous/pou/actions/action/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/types/pous/pou/actions/action/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/types/pous/pou/transitions
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc

0
0

maxOcc
content

1
complex

children

ppx:transition

source

<xsd:element name="transitions" minOccurs="0">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="transition" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/types/pous/pou/transitions/transition
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:body ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

globalId

xsd:ID

optional

source

Default

Fixed

<xsd:element name="transition" minOccurs="0" maxOccurs="unbounded">

annotation

<xsd:complexType>
<xsd:sequence>
<xsd:element name="body" type="ppx:body"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute project/types/pous/pou/transitions/transition/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute project/types/pous/pou/transitions/transition/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element project/types/pous/pou/transitions/transition/body
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:body

properties

isRef
content

0
complex

children

ppx:IL ppx:ST ppx:FBD ppx:LD ppx:SFC ppx:addData ppx:documentation

attributes

Name
WorksheetName

Type
xsd:string

Use
optional

globalId

xsd:ID

optional

source

Default

<xsd:element name="body" type="ppx:body"/>

element project/types/pous/pou/transitions/transition/addData
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:addData
isRef
minOcc
maxOcc
content

0
0
1
complex

Fixed

annotation

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/types/pous/pou/transitions/transition/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/types/pous/pou/body
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:body

properties

isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:IL ppx:ST ppx:FBD ppx:LD ppx:SFC ppx:addData ppx:documentation

attributes

Name
WorksheetName

Type
xsd:string

Use
optional

globalId

xsd:ID

optional

source

diagram

type
properties

Fixed

annotation

<xsd:element name="body" type="ppx:body" minOccurs="0" maxOccurs="unbounded"/>

element project/types/pous/pou/addData

namespace

Default

http://www.plcopen.org/xml/tc6_0201
ppx:addData
isRef
minOcc

0
0

maxOcc
content

1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/types/pous/pou/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/instances
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:configurations

source

<xsd:element name="instances">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="configurations">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="configuration" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of resources and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="resource" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>

<xsd:documentation>Represents a group of programs and tasks and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="task" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a periodic or triggered
task</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="single" type="xsd:string" use="optional"/>
<xsd:attribute name="interval" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>Vendor specific: Either a constant duration as defined in
the IEC or variable name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="priority" use="required">
<xsd:simpleType>
<xsd:restriction base="xsd:integer">
<xsd:minInclusive value="0"/>
<xsd:maxInclusive value="65535"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="accessVars" type="ppx:varListAccess" minOccurs="0"/>
<xsd:element name="configVars" type="ppx:varListConfig" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/instances/configurations
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:configuration

source

<xsd:element name="configurations">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="configuration" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of resources and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="resource" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of programs and tasks and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="task" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a periodic or triggered task</xsd:documentation>

</xsd:annotation>
<xsd:sequence>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="single" type="xsd:string" use="optional"/>
<xsd:attribute name="interval" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>Vendor specific: Either a constant duration as defined in the
IEC or variable name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="priority" use="required">
<xsd:simpleType>
<xsd:restriction base="xsd:integer">
<xsd:minInclusive value="0"/>
<xsd:maxInclusive value="65535"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="accessVars" type="ppx:varListAccess" minOccurs="0"/>
<xsd:element name="configVars" type="ppx:varListConfig" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>

</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element project/instances/configurations/configuration
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:resource ppx:globalVars ppx:accessVars ppx:configVars ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

globalId

xsd:ID

optional

source

Default

Fixed

<xsd:element name="configuration" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of resources and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="resource" minOccurs="0" maxOccurs="unbounded">

annotation

<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of programs and tasks and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="task" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a periodic or triggered task</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="single" type="xsd:string" use="optional"/>
<xsd:attribute name="interval" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>Vendor specific: Either a constant duration as defined in the IEC
or variable name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="priority" use="required">
<xsd:simpleType>
<xsd:restriction base="xsd:integer">
<xsd:minInclusive value="0"/>
<xsd:maxInclusive value="65535"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>

</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="accessVars" type="ppx:varListAccess" minOccurs="0"/>
<xsd:element name="configVars" type="ppx:varListConfig" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute project/instances/configurations/configuration/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute project/instances/configurations/configuration/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element project/instances/configurations/configuration/resource
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:task ppx:globalVars ppx:pouInstance ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="resource" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a group of programs and tasks and global
variables</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="task" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a periodic or triggered task</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the
element</xsd:documentation>
</xsd:annotation>

</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="single" type="xsd:string" use="optional"/>
<xsd:attribute name="interval" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>Vendor specific: Either a constant duration as defined in the IEC or
variable name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="priority" use="required">
<xsd:simpleType>
<xsd:restriction base="xsd:integer">
<xsd:minInclusive value="0"/>
<xsd:maxInclusive value="65535"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="globalVars" type="ppx:varList" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute project/instances/configurations/configuration/resource/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute project/instances/configurations/configuration/resource/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element project/instances/configurations/configuration/resource/task
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:pouInstance ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

single

xsd:string

optional

interval

xsd:string

optional

priority

derived by:
xsd:integer
xsd:ID

required

globalId
source

Default

Fixed

annotation

documentation
Vendor
specific: Either
a constant
duration as
defined in the
IEC or
variable name.

optional

<xsd:element name="task" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Represents a periodic or triggered task</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>

<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="single" type="xsd:string" use="optional"/>
<xsd:attribute name="interval" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>Vendor specific: Either a constant duration as defined in the IEC or
variable name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="priority" use="required">
<xsd:simpleType>
<xsd:restriction base="xsd:integer">
<xsd:minInclusive value="0"/>
<xsd:maxInclusive value="65535"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute project/instances/configurations/configuration/resource/task/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute project/instances/configurations/configuration/resource/task/@single
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="single" type="xsd:string" use="optional"/>

attribute project/instances/configurations/configuration/resource/task/@interval
type
properties
annotation
source

xsd:string
isRef 0
use optional
documentation
Vendor specific: Either a constant duration as defined in the IEC or variable name.

<xsd:attribute name="interval" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>Vendor specific: Either a constant duration as defined in the IEC or variable
name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute project/instances/configurations/configuration/resource/task/@priority
type

restriction of xsd:integer

properties

isRef 0
use required
minInclusive 0
maxInclusive 65535

facets
source

<xsd:attribute name="priority" use="required">
<xsd:simpleType>
<xsd:restriction base="xsd:integer">
<xsd:minInclusive value="0"/>
<xsd:maxInclusive value="65535"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>

attribute project/instances/configurations/configuration/resource/task/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element project/instances/configurations/configuration/resource/task/pouInstance
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:pouInstance
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

typeName

xsd:string

required

globalId

xsd:ID

optional

Default

Fixed

annotation

source

<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>

element project/instances/configurations/configuration/resource/task/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/instances/configurations/configuration/resource/task/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/instances/configurations/configuration/resource/globalVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:varList
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

Fixed

annotation

<xsd:element name="globalVars" type="ppx:varList" minOccurs="0" maxOccurs="unbounded"/>

element project/instances/configurations/configuration/resource/pouInstance
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:pouInstance
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

typeName

xsd:string

required

globalId

xsd:ID

optional

source

Default

Fixed

<xsd:element name="pouInstance" type="ppx:pouInstance" minOccurs="0"
maxOccurs="unbounded"/>

element project/instances/configurations/configuration/resource/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

annotation

element project/instances/configurations/configuration/resource/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/instances/configurations/configuration/globalVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:varList
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:variable ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
optional

Default

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

source

Fixed

<xsd:element name="globalVars" type="ppx:varList" minOccurs="0" maxOccurs="unbounded"/>

element project/instances/configurations/configuration/accessVars
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:varListAccess
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:accessVariable ppx:addData ppx:documentation

source

<xsd:element name="accessVars" type="ppx:varListAccess" minOccurs="0"/>

element project/instances/configurations/configuration/configVars
diagram

namespace
type
properties

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:varListConfig
isRef
minOcc
maxOcc

0
0
1

content

complex

children

ppx:configVariable ppx:addData ppx:documentation

source

<xsd:element name="configVars" type="ppx:varListConfig" minOccurs="0"/>

element project/instances/configurations/configuration/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/instances/configurations/configuration/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

element project/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element project/documentation
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

group commonObjects
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:comment ppx:error ppx:connector ppx:continuation ppx:actionBlock ppx:vendorElement

used by

elements

annotation
source

body/FBD body/LD body/SFC

documentation
Collection of objects which have no direct iec scope and can be used in any graphical body.

<xsd:group name="commonObjects">
<xsd:annotation>
<xsd:documentation>Collection of objects which have no direct iec scope and can be used in
any graphical body.</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:element name="comment">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="content" type="ppx:formattedText"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="error">
<xsd:complexType mixed="false">
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a conversion error. Used to
keep information which can not be interpreted by the importing system</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="content" type="ppx:formattedText"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

<xsd:attribute name="height" type="xsd:decimal" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="connector">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable, literal or
expression used as r-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="continuation">
<xsd:annotation>
<xsd:documentation>Counterpart of the connector element</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable, literal or
expression used as r-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="actionBlock">
<xsd:complexType>

<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Association of an action with qualifier</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="relPosition" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Relative position of the action. Origin is the anchor position of the
action block.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="reference" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Name of an action or boolean variable.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="inline" type="ppx:body" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Inline implementation of an action body.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="qualifier" use="optional" default="N">
<xsd:simpleType>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="P1"/>
<xsd:enumeration value="N"/>
<xsd:enumeration value="P0"/>
<xsd:enumeration value="R"/>
<xsd:enumeration value="S"/>
<xsd:enumeration value="L"/>
<xsd:enumeration value="D"/>
<xsd:enumeration value="P"/>
<xsd:enumeration value="DS"/>
<xsd:enumeration value="DL"/>
<xsd:enumeration value="SD"/>
<xsd:enumeration value="SL"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="duration" type="xsd:string" use="optional"/>
<xsd:attribute name="indicator" type="xsd:string" use="optional"/>

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="vendorElement">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a call
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Anchor position of the box. Top left corner excluding the instance
name.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="alternativeText" type="ppx:formattedText">
<xsd:annotation>
<xsd:documentation>An alternative text to be displayed in generic representation of
unknown elements.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="inputVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used input variables (consumers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>

<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used inOut variables</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"
minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used output variables (producers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>

<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData">
<xsd:annotation>
<xsd:documentation>Additional, vendor specific data for the element. Also defines the
vendor specific meaning of the element.</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId"/>
</xsd:complexType>
</xsd:element>
</xsd:choice>
</xsd:group>

element commonObjects/comment
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:content ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

required

width

xsd:decimal

required

globalId

xsd:ID

optional

source

Default

Fixed

<xsd:element name="comment">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="content" type="ppx:formattedText"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/comment/@localId
type
properties
source

annotation

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute commonObjects/comment/@height
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="height" type="xsd:decimal" use="required"/>

attribute commonObjects/comment/@width
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="width" type="xsd:decimal" use="required"/>

attribute commonObjects/comment/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element commonObjects/comment/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element commonObjects/comment/content
diagram

Default

Fixed

annotation

namespace
type
properties
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
content

0
complex

<xsd:element name="content" type="ppx:formattedText"/>

element commonObjects/comment/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element commonObjects/comment/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/error
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content
mixed

0
complex
false

children

ppx:position ppx:content ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

required

width

xsd:decimal

required

globalId

xsd:ID

optional

source

Fixed

annotation

<xsd:element name="error">
<xsd:complexType mixed="false">
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a conversion error. Used to
keep information which can not be interpreted by the importing system</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="content" type="ppx:formattedText"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/error/@localId
type

Default

xsd:unsignedLong

properties
source

isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute commonObjects/error/@height
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="height" type="xsd:decimal" use="required"/>

attribute commonObjects/error/@width
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="width" type="xsd:decimal" use="required"/>

attribute commonObjects/error/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element commonObjects/error/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element commonObjects/error/content
diagram

namespace
type
properties
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
content

0
complex

<xsd:element name="content" type="ppx:formattedText"/>

element commonObjects/error/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element commonObjects/error/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/connector
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

localId

xsd:unsignedLong

required

height

xsd:decimal

optional

width

xsd:decimal

optional

globalId

xsd:ID

optional

source

Default

Fixed

annotation
documentation
The operand
is a valid iec
variable e.g.
avar[0]

<xsd:element name="connector">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable, literal or expression
used as r-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/connector/@name
type
properties
annotation
source

xsd:string
isRef 0
use required
documentation
The operand is a valid iec variable e.g. avar[0]

<xsd:attribute name="name" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute commonObjects/connector/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute commonObjects/connector/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute commonObjects/connector/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute commonObjects/connector/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element commonObjects/connector/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element commonObjects/connector/connectionPointIn
diagram

namespace
type
properties

Default

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc

0
0

Fixed

annotation

maxOcc
content

1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element commonObjects/connector/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

0
0
1
complex

element commonObjects/connector/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/continuation
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointOut ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

localId

xsd:unsignedLong

required

height

xsd:decimal

optional

width

xsd:decimal

optional

globalId

xsd:ID

optional

annotation
source

Default

Fixed

annotation
documentation
The operand
is a valid iec
variable e.g.
avar[0]

documentation
Counterpart of the connector element

<xsd:element name="continuation">
<xsd:annotation>
<xsd:documentation>Counterpart of the connector element</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable, literal or expression
used as r-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>

<xsd:attribute name="name" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/continuation/@name
type
properties
annotation
source

xsd:string
isRef 0
use required
documentation
The operand is a valid iec variable e.g. avar[0]

<xsd:attribute name="name" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute commonObjects/continuation/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute commonObjects/continuation/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute commonObjects/continuation/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute commonObjects/continuation/@globalId
type

xsd:ID

properties
source

isRef
use

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element commonObjects/continuation/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

element commonObjects/continuation/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

Fixed

annotation

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element commonObjects/continuation/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

0
0
1
complex

element commonObjects/continuation/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/actionBlock
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:action ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

Default

negated

xsd:boolean

optional

false

width

xsd:decimal

optional

height

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

source

<xsd:element name="actionBlock">
<xsd:complexType>
<xsd:sequence>

Fixed

annotation

documentation
Used to
identify the
order of
execution.
Also used to
identify one
special block if
there are
several blocks
with the same
name.

<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Association of an action with qualifier</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="relPosition" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Relative position of the action. Origin is the anchor position of the
action block.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="reference" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Name of an action or boolean variable.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="inline" type="ppx:body" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Inline implementation of an action body.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="qualifier" use="optional" default="N">
<xsd:simpleType>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="P1"/>
<xsd:enumeration value="N"/>
<xsd:enumeration value="P0"/>
<xsd:enumeration value="R"/>
<xsd:enumeration value="S"/>
<xsd:enumeration value="L"/>
<xsd:enumeration value="D"/>
<xsd:enumeration value="P"/>
<xsd:enumeration value="DS"/>
<xsd:enumeration value="DL"/>
<xsd:enumeration value="SD"/>
<xsd:enumeration value="SL"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="duration" type="xsd:string" use="optional"/>
<xsd:attribute name="indicator" type="xsd:string" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>

<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/actionBlock/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute commonObjects/actionBlock/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute commonObjects/actionBlock/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute commonObjects/actionBlock/@height
type
properties

xsd:decimal
isRef
use

0
optional

source

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute commonObjects/actionBlock/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute commonObjects/actionBlock/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element commonObjects/actionBlock/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element commonObjects/actionBlock/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element commonObjects/actionBlock/action
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:relPosition ppx:reference ppx:inline ppx:connectionPointOut ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

Default

qualifier

optional

N

width

derived by:
xsd:NMTOKEN
xsd:decimal

height

xsd:decimal

optional

duration

xsd:string

optional

optional

Fixed

annotation

source

indicator

xsd:string

optional

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

documentation
Used to
identify the
order of
execution.
Also used to
identify one
special block if
there are
several blocks
with the same
name.

<xsd:element name="action" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Association of an action with qualifier</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="relPosition" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Relative position of the action. Origin is the anchor position of the
action block.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="reference" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Name of an action or boolean variable.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="inline" type="ppx:body" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Inline implementation of an action body.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="qualifier" use="optional" default="N">
<xsd:simpleType>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="P1"/>
<xsd:enumeration value="N"/>
<xsd:enumeration value="P0"/>
<xsd:enumeration value="R"/>
<xsd:enumeration value="S"/>
<xsd:enumeration value="L"/>
<xsd:enumeration value="D"/>
<xsd:enumeration value="P"/>
<xsd:enumeration value="DS"/>
<xsd:enumeration value="DL"/>

<xsd:enumeration value="SD"/>
<xsd:enumeration value="SL"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="duration" type="xsd:string" use="optional"/>
<xsd:attribute name="indicator" type="xsd:string" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/actionBlock/action/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute commonObjects/actionBlock/action/@qualifier
type
properties

facets

source

restriction of xsd:NMTOKEN
isRef 0
default N
use optional
enumeration P1
enumeration N
enumeration P0
enumeration R
enumeration S
enumeration L
enumeration D
enumeration P
enumeration DS
enumeration DL
enumeration SD
enumeration SL

<xsd:attribute name="qualifier" use="optional" default="N">
<xsd:simpleType>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="P1"/>
<xsd:enumeration value="N"/>
<xsd:enumeration value="P0"/>
<xsd:enumeration value="R"/>
<xsd:enumeration value="S"/>
<xsd:enumeration value="L"/>
<xsd:enumeration value="D"/>
<xsd:enumeration value="P"/>
<xsd:enumeration value="DS"/>

<xsd:enumeration value="DL"/>
<xsd:enumeration value="SD"/>
<xsd:enumeration value="SL"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>

attribute commonObjects/actionBlock/action/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute commonObjects/actionBlock/action/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute commonObjects/actionBlock/action/@duration
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="duration" type="xsd:string" use="optional"/>

attribute commonObjects/actionBlock/action/@indicator
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="indicator" type="xsd:string" use="optional"/>

attribute commonObjects/actionBlock/action/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute commonObjects/actionBlock/action/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element commonObjects/actionBlock/action/relPosition
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
annotation
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

annotation

documentation
Relative position of the action. Origin is the anchor position of the action block.

<xsd:element name="relPosition" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Relative position of the action. Origin is the anchor position of the action
block.</xsd:documentation>
</xsd:annotation>
</xsd:element>

element commonObjects/actionBlock/action/reference
diagram

namespace
properties

attributes
annotation

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content
Name
name

0
0
1
complex

documentation

Type
xsd:string

Use
required

Default

Fixed

annotation

Name of an action or boolean variable.
source

<xsd:element name="reference" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Name of an action or boolean variable.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/actionBlock/action/reference/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

element commonObjects/actionBlock/action/inline
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:body

properties

isRef
minOcc
maxOcc
content

children

0
0
1
complex

ppx:IL ppx:ST ppx:FBD ppx:LD ppx:SFC ppx:addData ppx:documentation

attributes

annotation
source

Name
WorksheetName

Type
xsd:string

Use
optional

globalId

xsd:ID

optional

Default

Fixed

annotation

documentation
Inline implementation of an action body.

<xsd:element name="inline" type="ppx:body" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Inline implementation of an action body.</xsd:documentation>
</xsd:annotation>
</xsd:element>

element commonObjects/actionBlock/action/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Fixed

annotation

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element commonObjects/actionBlock/action/addData
diagram

Default

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element commonObjects/actionBlock/action/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/actionBlock/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element commonObjects/actionBlock/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/vendorElement
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:alternativeText ppx:inputVariables ppx:inOutVariables ppx:outputVariables ppx:addData

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

width

xsd:decimal

optional

height

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

source

Default

Fixed

annotation

documentation
Used to
identify the
order of
execution.
Also used to
identify one
special block if
there are
several blocks
with the same
name.

<xsd:element name="vendorElement">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a call
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Anchor position of the box. Top left corner excluding the instance
name.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="alternativeText" type="ppx:formattedText">
<xsd:annotation>
<xsd:documentation>An alternative text to be displayed in generic representation of
unknown elements.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="inputVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used input variables (consumers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used inOut variables</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"
minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used output variables (producers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"

minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData">
<xsd:annotation>
<xsd:documentation>Additional, vendor specific data for the element. Also defines the
vendor specific meaning of the element.</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional" />
</xsd:complexType>
</xsd:element>

attribute commonObjects/vendorElement/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute commonObjects/vendorElement/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute commonObjects/vendorElement/@height
type

xsd:decimal

properties
source

isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute commonObjects/vendorElement/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute commonObjects/vendorElement/@globalId
properties
source

isRef
use

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional" />

element commonObjects/vendorElement/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

annotation
source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

annotation

documentation
Anchor position of the box. Top left corner excluding the instance name.

<xsd:element name="position" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Anchor position of the box. Top left corner excluding the instance
name.</xsd:documentation>
</xsd:annotation>

</xsd:element>

element commonObjects/vendorElement/alternativeText
diagram

namespace
type
properties
annotation
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
content complex
documentation
An alternative text to be displayed in generic representation of unknown elements.

<xsd:element name="alternativeText" type="ppx:formattedText">
<xsd:annotation>
<xsd:documentation>An alternative text to be displayed in generic representation of unknown
elements.</xsd:documentation>
</xsd:annotation>
</xsd:element>

element commonObjects/vendorElement/inputVariables
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
minOcc
maxOcc
content

children

ppx:variable

annotation
source

0
0
1
complex

documentation
The list of used input variables (consumers)

<xsd:element name="inputVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used input variables (consumers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element commonObjects/vendorElement/inputVariables/variable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:connectionPointIn ppx:documentation

attributes

Name
formalParameter

Type
xsd:string

Use
required

Default

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

hidden

xsd:boolean

optional

false

source

Fixed

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>

annotation

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/vendorElement/inputVariables/variable/@formalParameter
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

attribute commonObjects/vendorElement/inputVariables/variable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute commonObjects/vendorElement/inputVariables/variable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute commonObjects/vendorElement/inputVariables/variable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute commonObjects/vendorElement/inputVariables/variable/@hidden
type
properties

xsd:boolean
isRef

0

default
use
source

false
optional

<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>

element commonObjects/vendorElement/inputVariables/variable/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
content

0
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>

element commonObjects/vendorElement/inputVariables/variable/documentation
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText

annotation

properties

source

isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/vendorElement/inOutVariables
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
minOcc
maxOcc
content

children

ppx:variable

annotation
source

0
0
1
complex

documentation
The list of used inOut variables

<xsd:element name="inOutVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used inOut variables</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element commonObjects/vendorElement/inOutVariables/variable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:connectionPointIn ppx:connectionPointOut ppx:documentation

attributes

Name
formalParameter

Type
xsd:string

Use
required

Default

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

hidden

xsd:boolean

optional

false

source

Fixed

annotation

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/vendorElement/inOutVariables/variable/@formalParameter
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

attribute commonObjects/vendorElement/inOutVariables/variable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute commonObjects/vendorElement/inOutVariables/variable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute commonObjects/vendorElement/inOutVariables/variable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute commonObjects/vendorElement/inOutVariables/variable/@hidden
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>

element commonObjects/vendorElement/inOutVariables/variable/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element commonObjects/vendorElement/inOutVariables/variable/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element commonObjects/vendorElement/inOutVariables/variable/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/vendorElement/outputVariables
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
minOcc
maxOcc
content

children

ppx:variable

annotation
source

0
0
1
complex

documentation
The list of used output variables (producers)

<xsd:element name="outputVariables" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The list of used output variables (producers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element commonObjects/vendorElement/outputVariables/variable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:connectionPointOut ppx:documentation

attributes

Name
formalParameter

Type
xsd:string

Use
required

Default

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

hidden

xsd:boolean

optional

false

source

Fixed

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>

attribute commonObjects/vendorElement/outputVariables/variable/@formalParameter
type
properties

annotation

xsd:string
isRef
use

0
required

source

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

attribute commonObjects/vendorElement/outputVariables/variable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute commonObjects/vendorElement/outputVariables/variable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute commonObjects/vendorElement/outputVariables/variable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute commonObjects/vendorElement/outputVariables/variable/@hidden
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>

element commonObjects/vendorElement/outputVariables/variable/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element commonObjects/vendorElement/outputVariables/variable/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element commonObjects/vendorElement/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
content

children

ppx:data

annotation
source

0
complex

documentation
Additional, vendor specific data for the element. Also defines the vendor specific meaning of the element.

<xsd:element name="addData" type="ppx:addData">
<xsd:annotation>
<xsd:documentation>Additional, vendor specific data for the element. Also defines the vendor
specific meaning of the element.</xsd:documentation>
</xsd:annotation>
</xsd:element>

group derivedTypes
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:array ppx:derived ppx:enum ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned

used by

complexType

annotation
source

dataType

documentation
Collection of derived IEC 61131-3 datatypes

<xsd:group name="derivedTypes">
<xsd:annotation>
<xsd:documentation>Collection of derived IEC 61131-3 datatypes</xsd:documentation>
</xsd:annotation>
<xsd:choice>

<xsd:element name="array">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="dimension" type="ppx:rangeSigned" maxOccurs="unbounded"/>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="derived">
<xsd:annotation>
<xsd:documentation>Reference to a user defined datatype or POU. Variable declarations use
this type to declare e.g. function block instances.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>The user defined alias type</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="enum">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="values">
<xsd:complexType>
<xsd:sequence maxOccurs="unbounded">
<xsd:element name="value">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>An enumeration value used to build up enumeration
types</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="value" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="baseType" type="ppx:dataType" minOccurs="0"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="struct" type="ppx:varListPlain"/>
<xsd:element name="subrangeSigned">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="range" type="ppx:rangeSigned"/>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="subrangeUnsigned">

<xsd:complexType>
<xsd:sequence>
<xsd:element name="range" type="ppx:rangeUnsigned"/>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:choice>
</xsd:group>

element derivedTypes/array
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:dimension ppx:baseType

source

<xsd:element name="array">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="dimension" type="ppx:rangeSigned" maxOccurs="unbounded"/>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element derivedTypes/array/dimension
diagram

namespace
type
properties

attributes

http://www.plcopen.org/xml/tc6_0201
ppx:rangeSigned
isRef
minOcc
maxOcc
content
Name
lower
upper

0
1
unbounded
complex
Type
xsd:string

Use
required

xsd:string

required

Default

Fixed

annotation

source

<xsd:element name="dimension" type="ppx:rangeSigned" maxOccurs="unbounded"/>

element derivedTypes/array/baseType
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="baseType" type="ppx:dataType"/>

element derivedTypes/derived
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:addData

attributes

Name
name

annotation

documentation
Reference to a user defined datatype or POU. Variable declarations use this type to declare e.g. function block
instances.

source

Type
xsd:string

properties

Default

Fixed

annotation

<xsd:element name="derived">
<xsd:annotation>
<xsd:documentation>Reference to a user defined datatype or POU. Variable declarations use
this type to declare e.g. function block instances.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>The user defined alias type</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>

attribute derivedTypes/derived/@name
type

Use
required

xsd:string
isRef
use

0
required

source

<xsd:attribute name="name" type="xsd:string" use="required"/>

element derivedTypes/derived/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element derivedTypes/enum
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:values ppx:baseType

source

<xsd:element name="enum">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="values">
<xsd:complexType>
<xsd:sequence maxOccurs="unbounded">
<xsd:element name="value">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>An enumeration value used to build up enumeration
types</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="value" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="baseType" type="ppx:dataType" minOccurs="0"/>
</xsd:sequence>

</xsd:complexType>
</xsd:element>

element derivedTypes/enum/values
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

0
complex

children

ppx:value

source

<xsd:element name="values">
<xsd:complexType>
<xsd:sequence maxOccurs="unbounded">
<xsd:element name="value">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>An enumeration value used to build up enumeration
types</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="value" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element derivedTypes/enum/values/value
diagram

namespace
properties
attributes

http://www.plcopen.org/xml/tc6_0201
isRef
content
Name
name
value

source

0
complex
Type
xsd:string

Use
required

xsd:string

optional

Default

Fixed

<xsd:element name="value">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>An enumeration value used to build up enumeration
types</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="name" type="xsd:string" use="required"/>

annotation

<xsd:attribute name="value" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute derivedTypes/enum/values/value/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute derivedTypes/enum/values/value/@value
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="value" type="xsd:string" use="optional"/>

element derivedTypes/enum/baseType
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="baseType" type="ppx:dataType" minOccurs="0"/>

element derivedTypes/struct
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:varListPlain
isRef
content

0
complex

children

ppx:variable ppx:addData ppx:documentation

source

<xsd:element name="struct" type="ppx:varListPlain"/>

element derivedTypes/subrangeSigned
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:range ppx:baseType

source

<xsd:element name="subrangeSigned">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="range" type="ppx:rangeSigned"/>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>

</xsd:element>

element derivedTypes/subrangeSigned/range
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:rangeSigned
isRef
content
Name
lower
upper

source

0
complex
Type
xsd:string

Use
required

xsd:string

required

Default

<xsd:element name="range" type="ppx:rangeSigned"/>

Fixed

annotation

element derivedTypes/subrangeSigned/baseType
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="baseType" type="ppx:dataType"/>

element derivedTypes/subrangeUnsigned
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:range ppx:baseType

source

<xsd:element name="subrangeUnsigned">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="range" type="ppx:rangeUnsigned"/>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element derivedTypes/subrangeUnsigned/range
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:rangeUnsigned
isRef
content
Name
lower
upper

0
complex
Type
xsd:string

Use
required

xsd:string

required

Default

Fixed

annotation

source

<xsd:element name="range" type="ppx:rangeUnsigned"/>

element derivedTypes/subrangeUnsigned/baseType
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="baseType" type="ppx:dataType"/>

group elementaryTypes
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE

used by

complexType

annotation
source

dataType

documentation
Collection of elementary IEC 61131-3 datatypes

<xsd:group name="elementaryTypes">
<xsd:annotation>
<xsd:documentation>Collection of elementary IEC 61131-3 datatypes</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:element name="BOOL"/>
<xsd:element name="BYTE"/>
<xsd:element name="WORD"/>
<xsd:element name="DWORD"/>
<xsd:element name="LWORD"/>
<xsd:element name="SINT"/>
<xsd:element name="INT"/>
<xsd:element name="DINT"/>
<xsd:element name="LINT"/>
<xsd:element name="USINT"/>
<xsd:element name="UINT"/>
<xsd:element name="UDINT"/>
<xsd:element name="ULINT"/>
<xsd:element name="REAL"/>
<xsd:element name="LREAL"/>
<xsd:element name="TIME"/>
<xsd:element name="DATE"/>
<xsd:element name="DT"/>
<xsd:element name="TOD"/>
<xsd:element name="string">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>The single byte character string type</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="length" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="wstring">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>The wide character (WORD) string type</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="length" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="ANY"/>
<xsd:element name="ANY_DERIVED"/>
<xsd:element name="ANY_ELEMENTARY"/>
<xsd:element name="ANY_MAGNITUDE"/>
<xsd:element name="ANY_NUM"/>
<xsd:element name="ANY_REAL"/>
<xsd:element name="ANY_INT"/>

<xsd:element name="ANY_BIT"/>
<xsd:element name="ANY_STRING"/>
<xsd:element name="ANY_DATE"/>
</xsd:choice>
</xsd:group>

element elementaryTypes/BOOL
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="BOOL"/>

element elementaryTypes/BYTE
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="BYTE"/>

element elementaryTypes/WORD
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="WORD"/>

element elementaryTypes/DWORD
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="DWORD"/>

element elementaryTypes/LWORD
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="LWORD"/>

element elementaryTypes/SINT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="SINT"/>

element elementaryTypes/INT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="INT"/>

element elementaryTypes/DINT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="DINT"/>

element elementaryTypes/LINT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="LINT"/>

element elementaryTypes/USINT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="USINT"/>

element elementaryTypes/UINT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="UINT"/>

element elementaryTypes/UDINT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="UDINT"/>

element elementaryTypes/ULINT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ULINT"/>

element elementaryTypes/REAL
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="REAL"/>

element elementaryTypes/LREAL
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="LREAL"/>

element elementaryTypes/TIME
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="TIME"/>

element elementaryTypes/DATE
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="DATE"/>

element elementaryTypes/DT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="DT"/>

element elementaryTypes/TOD
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="TOD"/>

element elementaryTypes/string
diagram

namespace
properties
attributes
source

http://www.plcopen.org/xml/tc6_0201
isRef
content
Name
length

0
complex
Type
xsd:string

Use
optional

Default

Fixed

annotation

<xsd:element name="string">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>The single byte character string type</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="length" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute elementaryTypes/string/@length
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="length" type="xsd:string" use="optional"/>

element elementaryTypes/wstring
diagram

namespace
properties
attributes
source

http://www.plcopen.org/xml/tc6_0201
isRef
content
Name
length

0
complex
Type
xsd:string

Default

Fixed

annotation

<xsd:element name="wstring">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>The wide character (WORD) string type</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="length" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute elementaryTypes/wstring/@length
type

Use
optional

xsd:string

properties
source

isRef
use

0
optional

<xsd:attribute name="length" type="xsd:string" use="optional"/>

element elementaryTypes/ANY
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY"/>

element elementaryTypes/ANY_DERIVED
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY_DERIVED"/>

element elementaryTypes/ANY_ELEMENTARY
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY_ELEMENTARY"/>

element elementaryTypes/ANY_MAGNITUDE
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY_MAGNITUDE"/>

element elementaryTypes/ANY_NUM
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties
source

isRef

0

<xsd:element name="ANY_NUM"/>

element elementaryTypes/ANY_REAL
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY_REAL"/>

element elementaryTypes/ANY_INT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY_INT"/>

element elementaryTypes/ANY_BIT
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY_BIT"/>

element elementaryTypes/ANY_STRING
diagram

namespace
properties
source

http://www.plcopen.org/xml/tc6_0201
isRef

0

<xsd:element name="ANY_STRING"/>

element elementaryTypes/ANY_DATE
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties
source

isRef

0

<xsd:element name="ANY_DATE"/>

group extended
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:pointer

used by

complexType

annotation
source

dataType

documentation
Collection of datatypes not defined in IEC 61131-3

<xsd:group name="extended">
<xsd:annotation>
<xsd:documentation>Collection of datatypes not defined in IEC 61131-3</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:element name="pointer">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:choice>
</xsd:group>

element extended/pointer
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:baseType

source

<xsd:element name="pointer">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="baseType" type="ppx:dataType"/>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element extended/pointer/baseType
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="baseType" type="ppx:dataType"/>

group fbdObjects
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:block ppx:inVariable ppx:outVariable ppx:inOutVariable ppx:label ppx:jump ppx:return

used by

elements

annotation
source

body/FBD body/LD body/SFC

documentation
Collection of objects which are defined in fbd. They can be used in all graphical bodies.

<xsd:group name="fbdObjects">
<xsd:annotation>
<xsd:documentation>Collection of objects which are defined in fbd. They can be used in all
graphical bodies.</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:element name="block">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a call
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position">
<xsd:annotation>

<xsd:documentation>Anchor position of the box. Top left corner excluding the instance
name.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="inputVariables">
<xsd:annotation>
<xsd:documentation>The list of used input variables (consumers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVariables">
<xsd:annotation>
<xsd:documentation>The list of used inOut variables</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"
minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"

default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVariables">
<xsd:annotation>
<xsd:documentation>The list of used output variables (producers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="typeName" type="xsd:string" use="required"/>
<xsd:attribute name="instanceName" type="xsd:string" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="inVariable">
<xsd:annotation>
<xsd:documentation>Expression used as producer</xsd:documentation>

</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable, literal or
expression used as r-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g.
avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="outVariable">
<xsd:annotation>
<xsd:documentation>Expression used as consumer</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable or expression
used as l-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g.
avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVariable">
<xsd:annotation>
<xsd:documentation>Expression used as producer and consumer</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable which can be used
as l-value and r-value at the same time</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g.
avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negatedIn" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edgeIn" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storageIn" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="negatedOut" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edgeOut" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storageOut" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="label">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a jump
label</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

<xsd:attribute name="label" type="xsd:string" use="required"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="jump">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a jump
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="label" type="xsd:string" use="required"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="return">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing areturn
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:choice>
</xsd:group>

element fbdObjects/block
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:inputVariables ppx:inOutVariables ppx:outputVariables ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

width

xsd:decimal

optional

height

xsd:decimal

optional

typeName

xsd:string

required

instanceName

xsd:string

optional

executionOrderId

xsd:unsignedLong

optional

Default

Fixed

annotation

documentation
Used to
identify the

order of
execution.
Also used to
identify one
special block if
there are
several blocks
with the same
name.
globalId
source

xsd:ID

optional

<xsd:element name="block">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a call
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Anchor position of the box. Top left corner excluding the instance
name.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="inputVariables">
<xsd:annotation>
<xsd:documentation>The list of used input variables (consumers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="inOutVariables">
<xsd:annotation>
<xsd:documentation>The list of used inOut variables</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"
minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="outputVariables">
<xsd:annotation>
<xsd:documentation>The list of used output variables (producers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut"
minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional"
default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="typeName" type="xsd:string" use="required"/>
<xsd:attribute name="instanceName" type="xsd:string" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/block/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute fbdObjects/block/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute fbdObjects/block/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute fbdObjects/block/@typeName
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="typeName" type="xsd:string" use="required"/>

attribute fbdObjects/block/@instanceName
type
properties

xsd:string
isRef
use

0
optional

source

<xsd:attribute name="instanceName" type="xsd:string" use="optional"/>

attribute fbdObjects/block/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute fbdObjects/block/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element fbdObjects/block/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

annotation
source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

annotation

documentation
Anchor position of the box. Top left corner excluding the instance name.

<xsd:element name="position" type="ppx:position">
<xsd:annotation>
<xsd:documentation>Anchor position of the box. Top left corner excluding the instance
name.</xsd:documentation>
</xsd:annotation>
</xsd:element>

element fbdObjects/block/inputVariables
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

children

ppx:variable

annotation
source

0
complex

documentation
The list of used input variables (consumers)

<xsd:element name="inputVariables">
<xsd:annotation>
<xsd:documentation>The list of used input variables (consumers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element fbdObjects/block/inputVariables/variable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:connectionPointIn ppx:documentation

attributes

Name
formalParameter

Type
xsd:string

Use
required

Default

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

hidden

xsd:boolean

optional

false

source

properties

annotation

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes an inputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/block/inputVariables/variable/@formalParameter
type

Fixed

xsd:string
isRef
use

0
required

source

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

attribute fbdObjects/block/inputVariables/variable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute fbdObjects/block/inputVariables/variable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute fbdObjects/block/inputVariables/variable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute fbdObjects/block/inputVariables/variable/@hidden
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>

element fbdObjects/block/inputVariables/variable/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
content

0
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>

element fbdObjects/block/inputVariables/variable/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

annotation

element fbdObjects/block/inOutVariables
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

children

ppx:variable

annotation
source

0
complex

documentation
The list of used inOut variables

<xsd:element name="inOutVariables">
<xsd:annotation>
<xsd:documentation>The list of used inOut variables</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element fbdObjects/block/inOutVariables/variable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:connectionPointIn ppx:connectionPointOut ppx:documentation

attributes

Name
formalParameter

Type
xsd:string

Use
required

Default

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

hidden

xsd:boolean

optional

false

source

Fixed

annotation

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a inOutVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/block/inOutVariables/variable/@formalParameter
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

attribute fbdObjects/block/inOutVariables/variable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute fbdObjects/block/inOutVariables/variable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute fbdObjects/block/inOutVariables/variable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute fbdObjects/block/inOutVariables/variable/@hidden
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>

element fbdObjects/block/inOutVariables/variable/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element fbdObjects/block/inOutVariables/variable/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element fbdObjects/block/inOutVariables/variable/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/block/outputVariables
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

children

ppx:variable

annotation
source

0
complex

documentation
The list of used output variables (producers)

<xsd:element name="outputVariables">
<xsd:annotation>
<xsd:documentation>The list of used output variables (producers)</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element fbdObjects/block/outputVariables/variable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:connectionPointOut ppx:documentation

attributes

Name
formalParameter

Type
xsd:string

Use
required

Default

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

hidden

xsd:boolean

optional

false

source

properties

annotation

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a outputVariable of a Function or a
FunctionBlock</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/block/outputVariables/variable/@formalParameter
type

Fixed

xsd:string
isRef
use

0
required

source

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

attribute fbdObjects/block/outputVariables/variable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute fbdObjects/block/outputVariables/variable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute fbdObjects/block/outputVariables/variable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute fbdObjects/block/outputVariables/variable/@hidden
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="hidden" type="xsd:boolean" use="optional" default="false"/>

element fbdObjects/block/outputVariables/variable/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element fbdObjects/block/outputVariables/variable/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/block/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element fbdObjects/block/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/inVariable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointOut ppx:expression ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

globalId

xsd:ID

optional

annotation
source

Default

Fixed

annotation

documentation
Expression used as producer

<xsd:element name="inVariable">
<xsd:annotation>
<xsd:documentation>Expression used as producer</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable, literal or expression

used as r-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/inVariable/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute fbdObjects/inVariable/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute fbdObjects/inVariable/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute fbdObjects/inVariable/@executionOrderId
type
properties

xsd:unsignedLong
isRef
use

0
optional

source

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute fbdObjects/inVariable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute fbdObjects/inVariable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute fbdObjects/inVariable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute fbdObjects/inVariable/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element fbdObjects/inVariable/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

annotation

Fixed

annotation

<xsd:element name="position" type="ppx:position"/>

element fbdObjects/inVariable/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element fbdObjects/inVariable/expression
diagram

namespace
type
properties
annotation
source

http://www.plcopen.org/xml/tc6_0201
xsd:string
isRef 0
content simple
documentation
The operand is a valid iec variable e.g. avar[0].

<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>

element fbdObjects/inVariable/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element fbdObjects/inVariable/documentation
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

source

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/outVariable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:expression ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

globalId

xsd:ID

optional

annotation
source

Default

Fixed

documentation
Expression used as consumer

<xsd:element name="outVariable">
<xsd:annotation>
<xsd:documentation>Expression used as consumer</xsd:documentation>

annotation

</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable or expression used
as l-value</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/outVariable/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute fbdObjects/outVariable/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute fbdObjects/outVariable/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute fbdObjects/outVariable/@executionOrderId
type
properties
source

xsd:unsignedLong
isRef
use

0
optional

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute fbdObjects/outVariable/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute fbdObjects/outVariable/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute fbdObjects/outVariable/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute fbdObjects/outVariable/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element fbdObjects/outVariable/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element fbdObjects/outVariable/connectionPointIn
diagram

namespace
type
properties

Default

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc

0
0

Fixed

annotation

maxOcc
content

1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element fbdObjects/outVariable/expression
diagram

namespace
type
properties
annotation
source

http://www.plcopen.org/xml/tc6_0201
xsd:string
isRef 0
content simple
documentation
The operand is a valid iec variable e.g. avar[0].

<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>

element fbdObjects/outVariable/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element fbdObjects/outVariable/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/inOutVariable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:expression ppx:addData ppx:documentation

attributes

Name

Type

Use

Default

Fixed

annotation

annotation
source

localId

xsd:unsignedLong

required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

negatedIn

xsd:boolean

optional

false

edgeIn

ppx:edgeModifierType

optional

none

storageIn

ppx:storageModifierType

optional

none

negatedOut

xsd:boolean

optional

false

edgeOut

ppx:edgeModifierType

optional

none

storageOut

ppx:storageModifierType

optional

none

globalId

xsd:ID

optional

documentation
Expression used as producer and consumer

<xsd:element name="inOutVariable">
<xsd:annotation>
<xsd:documentation>Expression used as producer and consumer</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable which can be used
as l-value and r-value at the same time</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negatedIn" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edgeIn" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storageIn" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="negatedOut" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edgeOut" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storageOut" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/inOutVariable/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute fbdObjects/inOutVariable/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute fbdObjects/inOutVariable/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute fbdObjects/inOutVariable/@executionOrderId
type
properties
source

xsd:unsignedLong
isRef
use

0
optional

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute fbdObjects/inOutVariable/@negatedIn
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negatedIn" type="xsd:boolean" use="optional" default="false"/>

attribute fbdObjects/inOutVariable/@edgeIn
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edgeIn" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute fbdObjects/inOutVariable/@storageIn
type

ppx:storageModifierType

properties

facets

source

isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storageIn" type="ppx:storageModifierType" use="optional" default="none"/>

attribute fbdObjects/inOutVariable/@negatedOut
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negatedOut" type="xsd:boolean" use="optional" default="false"/>

attribute fbdObjects/inOutVariable/@edgeOut
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edgeOut" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute fbdObjects/inOutVariable/@storageOut
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storageOut" type="ppx:storageModifierType" use="optional" default="none"/>

attribute fbdObjects/inOutVariable/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element fbdObjects/inOutVariable/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element fbdObjects/inOutVariable/connectionPointIn
diagram

namespace
type
properties

Default

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc

0
0

Fixed

annotation

maxOcc
content

1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element fbdObjects/inOutVariable/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

diagram

type
properties
annotation

Fixed

annotation

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element fbdObjects/inOutVariable/expression

namespace

Default

http://www.plcopen.org/xml/tc6_0201
xsd:string
isRef 0
content simple
documentation
The operand is a valid iec variable e.g. avar[0].

source

<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>

element fbdObjects/inOutVariable/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element fbdObjects/inOutVariable/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/label
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

label

xsd:string

required

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="label">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a jump
label</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="label" type="xsd:string" use="required"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/label/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute fbdObjects/label/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute fbdObjects/label/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute fbdObjects/label/@label
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="label" type="xsd:string" use="required"/>

attribute fbdObjects/label/@executionOrderId
type
properties
source

xsd:unsignedLong
isRef
use

0
optional

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute fbdObjects/label/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element fbdObjects/label/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

<xsd:element name="position" type="ppx:position"/>

element fbdObjects/label/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element fbdObjects/label/documentation
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc

0
0
1

annotation

content
source

complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/jump
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

label

xsd:string

required

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="jump">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a jump
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="label" type="xsd:string" use="required"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/jump/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute fbdObjects/jump/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute fbdObjects/jump/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute fbdObjects/jump/@label
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="label" type="xsd:string" use="required"/>

attribute fbdObjects/jump/@executionOrderId
type
properties
source

xsd:unsignedLong
isRef
use

0
optional

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute fbdObjects/jump/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element fbdObjects/jump/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element fbdObjects/jump/connectionPointIn
diagram

namespace

Default

http://www.plcopen.org/xml/tc6_0201

Fixed

annotation

type
properties

ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element fbdObjects/jump/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

0
0
1
complex

element fbdObjects/jump/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element fbdObjects/return
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="return">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing areturn
statement</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute fbdObjects/return/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute fbdObjects/return/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute fbdObjects/return/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute fbdObjects/return/@executionOrderId
type
properties
source

xsd:unsignedLong
isRef
use

0
optional

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute fbdObjects/return/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element fbdObjects/return/position
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:position

properties
attributes

isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

annotation

Fixed

annotation

<xsd:element name="position" type="ppx:position"/>

element fbdObjects/return/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element fbdObjects/return/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element fbdObjects/return/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

group ldObjects
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:leftPowerRail ppx:rightPowerRail ppx:coil ppx:contact

used by

elements

annotation
source

body/LD body/SFC

documentation
Collection of objects which are defined in ld and are an extension to fbd. They can be used in ld and sfc bodies

<xsd:group name="ldObjects">
<xsd:annotation>

<xsd:documentation>Collection of objects which are defined in ld and are an extension to fbd.
They can be used in ld and sfc bodies</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:element name="leftPowerRail">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a left
powerrail</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="rightPowerRail">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a right
powerrail</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>

</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="coil">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a boolean variable which can
be used as l-value and r-value at the same time</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="variable" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid boolean iec variable e.g.
avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="contact">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable which can be used
as l-value and r-value at the same time</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="variable" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid boolean iec variable e.g.
avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional"
default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:choice>
</xsd:group>

element ldObjects/leftPowerRail
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointOut ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

Default

Fixed

annotation

documentation
Used to
identify the
order of
execution.
Also used to
identify one

special block if
there are
several blocks
with the same
name.
globalId
source

xsd:ID

optional

<xsd:element name="leftPowerRail">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a left
powerrail</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute ldObjects/leftPowerRail/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute ldObjects/leftPowerRail/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute ldObjects/leftPowerRail/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute ldObjects/leftPowerRail/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute ldObjects/leftPowerRail/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element ldObjects/leftPowerRail/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element ldObjects/leftPowerRail/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

Type
xsd:ID

Use
optional

formalParameter

xsd:string

required

source

Default

Fixed

<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

attribute ldObjects/leftPowerRail/connectionPointOut/@formalParameter
type
properties
source

annotation

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

element ldObjects/leftPowerRail/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element ldObjects/leftPowerRail/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element ldObjects/rightPowerRail
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

source

Default

Fixed

<xsd:element name="rightPowerRail">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a right
powerrail</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>

annotation

documentation
Used to
identify the
order of
execution.
Also used to
identify one
special block if
there are
several blocks
with the same
name.

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute ldObjects/rightPowerRail/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute ldObjects/rightPowerRail/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute ldObjects/rightPowerRail/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute ldObjects/rightPowerRail/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>

</xsd:annotation>
</xsd:attribute>

attribute ldObjects/rightPowerRail/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element ldObjects/rightPowerRail/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element ldObjects/rightPowerRail/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

diagram

type
properties

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"
maxOccurs="unbounded"/>

element ldObjects/rightPowerRail/addData

namespace

Use
optional

http://www.plcopen.org/xml/tc6_0201
ppx:addData
isRef
minOcc
maxOcc

0
0
1

content

complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element ldObjects/rightPowerRail/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element ldObjects/coil
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:variable ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="coil">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a boolean variable which can
be used as l-value and r-value at the same time</xsd:documentation>
</xsd:annotation>

<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="variable" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid boolean iec variable e.g.
avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute ldObjects/coil/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute ldObjects/coil/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute ldObjects/coil/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute ldObjects/coil/@executionOrderId
type
properties

xsd:unsignedLong
isRef
use

0
optional

source

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute ldObjects/coil/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute ldObjects/coil/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute ldObjects/coil/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute ldObjects/coil/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element ldObjects/coil/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element ldObjects/coil/connectionPointIn
diagram

namespace
type
properties

Default

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc

0
0

Fixed

annotation

maxOcc
content

1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element ldObjects/coil/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

diagram

type
properties
annotation

Fixed

annotation

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element ldObjects/coil/variable

namespace

Default

http://www.plcopen.org/xml/tc6_0201
xsd:string
isRef 0
content simple
documentation
The operand is a valid boolean iec variable e.g. avar[0]

source

<xsd:element name="variable" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid boolean iec variable e.g.
avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:element>

element ldObjects/coil/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element ldObjects/coil/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element ldObjects/contact
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:variable ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

executionOrderId

xsd:unsignedLong

optional

negated

xsd:boolean

optional

false

edge

ppx:edgeModifierType

optional

none

storage

ppx:storageModifierType

optional

none

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="contact">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Describes a graphical object representing a variable which can be used
as l-value and r-value at the same time</xsd:documentation>
</xsd:annotation>

<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="variable" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid boolean iec variable e.g.
avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>
<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute ldObjects/contact/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute ldObjects/contact/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute ldObjects/contact/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute ldObjects/contact/@executionOrderId
type
properties

xsd:unsignedLong
isRef
use

0
optional

source

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional"/>

attribute ldObjects/contact/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute ldObjects/contact/@edge
type

ppx:edgeModifierType

properties

isRef 0
default none
use optional
enumeration none
enumeration falling
enumeration rising

facets

source

<xsd:attribute name="edge" type="ppx:edgeModifierType" use="optional" default="none"/>

attribute ldObjects/contact/@storage
type
properties

facets

source

ppx:storageModifierType
isRef 0
default none
use optional
enumeration none
enumeration set
enumeration reset

<xsd:attribute name="storage" type="ppx:storageModifierType" use="optional" default="none"/>

attribute ldObjects/contact/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element ldObjects/contact/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element ldObjects/contact/connectionPointIn
diagram

namespace
type
properties

Default

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc

0
0

Fixed

annotation

maxOcc
content

1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element ldObjects/contact/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

diagram

type
properties
annotation

Fixed

annotation

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element ldObjects/contact/variable

namespace

Default

http://www.plcopen.org/xml/tc6_0201
xsd:string
isRef 0
content simple
documentation
The operand is a valid boolean iec variable e.g. avar[0]

source

<xsd:element name="variable" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid boolean iec variable e.g.
avar[0]</xsd:documentation>
</xsd:annotation>
</xsd:element>

element ldObjects/contact/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element ldObjects/contact/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

group sfcObjects
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:step ppx:macroStep ppx:jumpStep ppx:transition ppx:selectionDivergence ppx:selectionConvergence
ppx:simultaneousDivergence ppx:simultaneousConvergence

used by

element

annotation
source

body/SFC

documentation
Collection of objects which are defined in sfc. They can only be used in sfc bodies

<xsd:group name="sfcObjects">
<xsd:annotation>
<xsd:documentation>Collection of objects which are defined in sfc. They can only be used in sfc
bodies</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:element name="step">
<xsd:annotation>
<xsd:documentation>A single step in a SFC Sequence. Actions are associated with a step by
using an actionBlock element with a connection to the step element</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Contains actions</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" minOccurs="0">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="connectionPointOutAction" minOccurs="0">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="initialStep" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="macroStep">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="body" type="ppx:body" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="name" type="xsd:string" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="jumpStep">

<xsd:annotation>
<xsd:documentation>Jump to a step, macro step or simultaneous divergence. Acts like a step.
Predecessor should be a transition.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="targetName" type="xsd:string" use="required"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="transition">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="condition" minOccurs="0">
<xsd:complexType>
<xsd:choice>
<xsd:element name="reference">
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="inline">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:body">
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
</xsd:choice>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="priority" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>The priority of a transition is evaluated, if the transition is connected to
a selectionDivergence element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one
special block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="selectionDivergence">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="selectionConvergence">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointIn"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="simultaneousDivergence">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="name" type="xsd:string" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="simultaneousConvergence">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
</xsd:choice>
</xsd:group>

element sfcObjects/step
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:connectionPointOutAction ppx:addData
ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

name

xsd:string

required

initialStep

xsd:boolean

optional

false

negated

xsd:boolean

optional

false

executionOrderId

xsd:unsignedLong

optional

Default

Fixed

annotation

documentation
Used to
identify the
order of
execution.
Also used to
identify one
special block if

there are
several blocks
with the same
name.
globalId

xsd:ID

optional

annotation

documentation
A single step in a SFC Sequence. Actions are associated with a step by using an actionBlock element with a connection
to the step element

source

<xsd:element name="step">
<xsd:annotation>
<xsd:documentation>A single step in a SFC Sequence. Actions are associated with a step by
using an actionBlock element with a connection to the step element</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Contains actions</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" minOccurs="0">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="connectionPointOutAction" minOccurs="0">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="initialStep" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/step/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/step/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/step/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/step/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute sfcObjects/step/@initialStep
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="initialStep" type="xsd:boolean" use="optional" default="false"/>

attribute sfcObjects/step/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

attribute sfcObjects/step/@executionOrderId
type

xsd:unsignedLong

properties
annotation

source

isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute sfcObjects/step/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/step/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element sfcObjects/step/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element sfcObjects/step/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

Type
xsd:ID

Use
optional

formalParameter

xsd:string

required

source

Default

Fixed

<xsd:element name="connectionPointOut" minOccurs="0">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/step/connectionPointOut/@formalParameter
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

annotation

element sfcObjects/step/connectionPointOutAction
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

Type
xsd:ID

Use
optional

formalParameter

xsd:string

required

source

Default

Fixed

<xsd:element name="connectionPointOutAction" minOccurs="0">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/step/connectionPointOutAction/@formalParameter
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

annotation

element sfcObjects/step/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element sfcObjects/step/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element sfcObjects/macroStep
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:body ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

name

xsd:string

optional

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

source

<xsd:element name="macroStep">
<xsd:complexType>

Default

Fixed

annotation

documentation
Used to
identify the
order of
execution.
Also used to
identify one
special block if
there are
several blocks
with the same
name.

<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="body" type="ppx:body" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="name" type="xsd:string" use="optional"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/macroStep/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/macroStep/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/macroStep/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/macroStep/@name
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="name" type="xsd:string" use="optional"/>

attribute sfcObjects/macroStep/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute sfcObjects/macroStep/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/macroStep/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element sfcObjects/macroStep/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element sfcObjects/macroStep/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element sfcObjects/macroStep/body
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:body

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:IL ppx:ST ppx:FBD ppx:LD ppx:SFC ppx:addData ppx:documentation

attributes

Name
WorksheetName

Type
xsd:string

Use
optional

globalId

xsd:ID

optional

source

<xsd:element name="body" type="ppx:body" minOccurs="0"/>

element sfcObjects/macroStep/addData
diagram

namespace
type
properties

Default

http://www.plcopen.org/xml/tc6_0201
ppx:addData
isRef
minOcc

0
0

Fixed

annotation

maxOcc
content

1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element sfcObjects/macroStep/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element sfcObjects/jumpStep
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

targetName

xsd:string

required

executionOrderId

xsd:unsignedLong

optional

globalId

xsd:ID

optional

annotation
source

Default

Fixed

properties
source

documentation
Used to
identify the
order of
execution.
Also used to
identify one
special block if
there are
several blocks
with the same
name.

documentation
Jump to a step, macro step or simultaneous divergence. Acts like a step. Predecessor should be a transition.

<xsd:element name="jumpStep">
<xsd:annotation>
<xsd:documentation>Jump to a step, macro step or simultaneous divergence. Acts like a step.
Predecessor should be a transition.</xsd:documentation>
</xsd:annotation>
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="targetName" type="xsd:string" use="required"/>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/jumpStep/@localId
type

annotation

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/jumpStep/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/jumpStep/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/jumpStep/@targetName
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="targetName" type="xsd:string" use="required"/>

attribute sfcObjects/jumpStep/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute sfcObjects/jumpStep/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/jumpStep/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x

0
complex

y
source

Type
xsd:decimal

Use
required

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element sfcObjects/jumpStep/connectionPointIn
diagram

namespace
type
properties

Default

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc

0
0

Fixed

annotation

maxOcc
content

1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element sfcObjects/jumpStep/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

0
0
1
complex

element sfcObjects/jumpStep/documentation
diagram

namespace
type
properties

source

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element sfcObjects/transition
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:condition ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

priority

xsd:unsignedLong

optional

executionOrderId

xsd:unsignedLong

optional

Default

Fixed

annotation

documentation
The priority of a
transition is
evaluated, if the
transition is
connected to a
selectionDivergence
element.
documentation
Used to identify the
order of execution.
Also used to identify
one special block if

there are several
blocks with the
same name.
globalId
source

xsd:ID

optional

<xsd:element name="transition">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="condition" minOccurs="0">
<xsd:complexType>
<xsd:choice>
<xsd:element name="reference">
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="inline">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:body">
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
</xsd:choice>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="priority" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>The priority of a transition is evaluated, if the transition is connected to a
selectionDivergence element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/transition/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/transition/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/transition/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/transition/@priority
type
properties
annotation
source

xsd:unsignedLong
isRef 0
use optional
documentation
The priority of a transition is evaluated, if the transition is connected to a selectionDivergence element.

<xsd:attribute name="priority" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>The priority of a transition is evaluated, if the transition is connected to a
selectionDivergence element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute sfcObjects/transition/@executionOrderId
type
properties
annotation

source

xsd:unsignedLong
isRef 0
use optional
documentation
Used to identify the order of execution. Also used to identify one special block if there are several blocks with the same
name.

<xsd:attribute name="executionOrderId" type="xsd:unsignedLong" use="optional">
<xsd:annotation>
<xsd:documentation>Used to identify the order of execution. Also used to identify one special
block if there are several blocks with the same name.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute sfcObjects/transition/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/transition/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element sfcObjects/transition/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element sfcObjects/transition/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element sfcObjects/transition/condition
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:reference ppx:connectionPointIn ppx:inline

attributes

Name
negated

Type
xsd:boolean

Use
optional

Default
false

Fixed

annotation

source

<xsd:element name="condition" minOccurs="0">
<xsd:complexType>
<xsd:choice>
<xsd:element name="reference">
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>
<xsd:element name="inline">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:body">
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
</xsd:choice>
<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/transition/condition/@negated
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="negated" type="xsd:boolean" use="optional" default="false"/>

element sfcObjects/transition/condition/reference
diagram

namespace
properties
attributes
source

http://www.plcopen.org/xml/tc6_0201
isRef
content
Name
name

0
complex
Type
xsd:string

Use
required

<xsd:element name="reference">
<xsd:complexType>
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/transition/condition/reference/@name
type

Default

xsd:string

Fixed

annotation

properties
source

isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

element sfcObjects/transition/condition/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
content

0
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn"/>

annotation

element sfcObjects/transition/condition/inline
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:body
isRef
content

0
complex

children

ppx:IL ppx:ST ppx:FBD ppx:LD ppx:SFC ppx:addData ppx:documentation

attributes

Name
WorksheetName

Type
xsd:string

Use
optional

globalId

xsd:ID

optional

name

xsd:string

required

source

Default

Fixed

<xsd:element name="inline">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:body">
<xsd:attribute name="name" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

annotation

attribute sfcObjects/transition/condition/inline/@name
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

element sfcObjects/transition/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element sfcObjects/transition/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element sfcObjects/selectionDivergence
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="selectionDivergence">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

</xsd:complexType>
</xsd:element>

attribute sfcObjects/selectionDivergence/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/selectionDivergence/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/selectionDivergence/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/selectionDivergence/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/selectionDivergence/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name

0
complex
Type

Use

Default

Fixed

annotation

source

x

xsd:decimal

required

y

xsd:decimal

required

<xsd:element name="position" type="ppx:position"/>

element sfcObjects/selectionDivergence/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element sfcObjects/selectionDivergence/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

Type
xsd:ID

Use
optional

formalParameter

xsd:string

required

source

Default

Fixed

<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/selectionDivergence/connectionPointOut/@formalParameter
type
properties
source

annotation

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

element sfcObjects/selectionDivergence/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element sfcObjects/selectionDivergence/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element sfcObjects/selectionConvergence
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

globalId

xsd:ID

optional

source

Default

Fixed

annotation

<xsd:element name="selectionConvergence">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointIn"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/selectionConvergence/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/selectionConvergence/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/selectionConvergence/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/selectionConvergence/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/selectionConvergence/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

annotation

source

<xsd:element name="position" type="ppx:position"/>

element sfcObjects/selectionConvergence/connectionPointIn
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

extension of ppx:connectionPointIn

properties

isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointIn" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointIn"/>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

annotation

element sfcObjects/selectionConvergence/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element sfcObjects/selectionConvergence/addData
diagram

namespace
type

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element sfcObjects/selectionConvergence/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element sfcObjects/simultaneousDivergence
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

name

xsd:string

optional

globalId

xsd:ID

optional

source

<xsd:element name="simultaneousDivergence">

Default

Fixed

annotation

<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>
<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="name" type="xsd:string" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/simultaneousDivergence/@localId
type
properties
source

xsd:unsignedLong
isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/simultaneousDivergence/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/simultaneousDivergence/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/simultaneousDivergence/@name
type
properties

xsd:string
isRef
use

0
optional

source

<xsd:attribute name="name" type="xsd:string" use="optional"/>

attribute sfcObjects/simultaneousDivergence/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/simultaneousDivergence/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element sfcObjects/simultaneousDivergence/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"/>

element sfcObjects/simultaneousDivergence/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

Type
xsd:ID

Use
optional

formalParameter

xsd:string

required

source

Default

Fixed

<xsd:element name="connectionPointOut" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:connectionPointOut">
<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/simultaneousDivergence/connectionPointOut/@formalParameter
type
properties
source

annotation

xsd:string
isRef
use

0
required

<xsd:attribute name="formalParameter" type="xsd:string" use="required"/>

element sfcObjects/simultaneousDivergence/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element sfcObjects/simultaneousDivergence/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element sfcObjects/simultaneousConvergence
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:position ppx:connectionPointIn ppx:connectionPointOut ppx:addData ppx:documentation

attributes

Name
localId

Type
xsd:unsignedLong

Use
required

height

xsd:decimal

optional

width

xsd:decimal

optional

globalId

xsd:ID

optional

source

Fixed

annotation

<xsd:element name="simultaneousConvergence">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="position" type="ppx:position"/>
<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"
maxOccurs="unbounded"/>
<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>
<xsd:attribute name="height" type="xsd:decimal" use="optional"/>
<xsd:attribute name="width" type="xsd:decimal" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute sfcObjects/simultaneousConvergence/@localId
type

Default

xsd:unsignedLong

properties
source

isRef
use

0
required

<xsd:attribute name="localId" type="xsd:unsignedLong" use="required"/>

attribute sfcObjects/simultaneousConvergence/@height
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="height" type="xsd:decimal" use="optional"/>

attribute sfcObjects/simultaneousConvergence/@width
type
properties
source

xsd:decimal
isRef
use

0
optional

<xsd:attribute name="width" type="xsd:decimal" use="optional"/>

attribute sfcObjects/simultaneousConvergence/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element sfcObjects/simultaneousConvergence/position
diagram

namespace
type
properties
attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
content
Name
x
y

source

0
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

<xsd:element name="position" type="ppx:position"/>

Fixed

annotation

element sfcObjects/simultaneousConvergence/connectionPointIn
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointIn
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

annotation

<xsd:element name="connectionPointIn" type="ppx:connectionPointIn" minOccurs="0"
maxOccurs="unbounded"/>

element sfcObjects/simultaneousConvergence/connectionPointOut
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connectionPointOut
isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:relPosition ppx:expression ppx:addData

attributes

Name
globalId

source

Type
xsd:ID

Use
optional

Default

Fixed

<xsd:element name="connectionPointOut" type="ppx:connectionPointOut" minOccurs="0"/>

element sfcObjects/simultaneousConvergence/addData
diagram

namespace
type

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element sfcObjects/simultaneousConvergence/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

complexType addData
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:data

used by

elements

annotation
source

commonObjects/connector/addData commonObjects/continuation/addData
commonObjects/actionBlock/action/addData commonObjects/actionBlock/addData
commonObjects/vendorElement/addData fbdObjects/block/addData fbdObjects/inVariable/addData
fbdObjects/outVariable/addData fbdObjects/inOutVariable/addData fbdObjects/label/addData
fbdObjects/jump/addData fbdObjects/return/addData ldObjects/leftPowerRail/addData
ldObjects/rightPowerRail/addData ldObjects/coil/addData ldObjects/contact/addData
sfcObjects/step/addData sfcObjects/macroStep/addData sfcObjects/jumpStep/addData
sfcObjects/transition/addData sfcObjects/selectionDivergence/addData
sfcObjects/selectionConvergence/addData sfcObjects/simultaneousDivergence/addData
sfcObjects/simultaneousConvergence/addData project/contentHeader/addData
project/types/dataTypes/dataType/addData project/types/pous/pou/interface/addData
project/types/pous/pou/actions/action/addData project/types/pous/pou/transitions/transition/addData
project/types/pous/pou/addData
project/instances/configurations/configuration/resource/task/addData
project/instances/configurations/configuration/resource/addData
project/instances/configurations/configuration/addData project/addData body/addData
varListPlain/variable/addData varListPlain/addData varListAccess/accessVariable/addData
varListAccess/addData varListConfig/configVariable/addData varListConfig/addData
connection/addData connectionPointIn/addData connectionPointOut/addData pouInstance/addData
derivedTypes/derived/addData commonObjects/comment/addData commonObjects/error/addData
documentation
Application specific data defined in external schemata

<xsd:complexType name="addData">
<xsd:annotation>
<xsd:documentation>Application specific data defined in external schemata
</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="data" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:any namespace="##any" processContents="lax"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:anyURI" use="required">

<xsd:annotation>
<xsd:documentation>Uniquely identifies the additional data element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="handleUnknown" use="required">
<xsd:annotation>
<xsd:documentation>Recommended processor handling for unknown data elements.
Specifies if the processor should try to preserve the additional data element, dismiss the element
(e.g. because the data is invalid if not updated correctly) or use the processors default behaviour
for unknown data.</xsd:documentation>
</xsd:annotation>
<xsd:simpleType>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="preserve"/>
<xsd:enumeration value="discard"/>
<xsd:enumeration value="implementation"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>

element addData/data
diagram

namespace
properties

attributes

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content
Name
name

0
0
unbounded
complex
Type
xsd:anyURI

Use
required

Default

Fixed

annotation
documentation
Uniquely
identifies the
additional data
element.

handleUnknown

source

derived by:
xsd:NMTOKEN

required

<xsd:element name="data" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:any namespace="##any" processContents="lax"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:anyURI" use="required">
<xsd:annotation>
<xsd:documentation>Uniquely identifies the additional data element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="handleUnknown" use="required">
<xsd:annotation>
<xsd:documentation>Recommended processor handling for unknown data elements.
Specifies if the processor should try to preserve the additional data element, dismiss the element
(e.g. because the data is invalid if not updated correctly) or use the processors default behaviour
for unknown data.</xsd:documentation>
</xsd:annotation>
<xsd:simpleType>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="preserve"/>
<xsd:enumeration value="discard"/>
<xsd:enumeration value="implementation"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>
</xsd:complexType>
</xsd:element>

attribute addData/data/@name
type
properties
annotation
source

documentation
Recommended
processor
handling for
unknown data
elements.
Specifies if the
processor
should try to
preserve the
additional data
element,
dismiss the
element (e.g.
because the
data is invalid
if not updated
correctly) or
use the
processors
default
behaviour for
unknown data.

xsd:anyURI
isRef 0
use required
documentation
Uniquely identifies the additional data element.

<xsd:attribute name="name" type="xsd:anyURI" use="required">

<xsd:annotation>
<xsd:documentation>Uniquely identifies the additional data element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute addData/data/@handleUnknown
type
properties
facets

annotation

source

restriction of xsd:NMTOKEN
isRef 0
use required
enumeration preserve
enumeration discard
enumeration implementation
documentation
Recommended processor handling for unknown data elements.
Specifies if the processor should try to preserve the additional data element, dismiss the element (e.g. because the data
is invalid if not updated correctly) or use the processors default behaviour for unknown data.

<xsd:attribute name="handleUnknown" use="required">
<xsd:annotation>
<xsd:documentation>Recommended processor handling for unknown data elements.
Specifies if the processor should try to preserve the additional data element, dismiss the element
(e.g. because the data is invalid if not updated correctly) or use the processors default behaviour for
unknown data.</xsd:documentation>
</xsd:annotation>
<xsd:simpleType>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="preserve"/>
<xsd:enumeration value="discard"/>
<xsd:enumeration value="implementation"/>
</xsd:restriction>
</xsd:simpleType>
</xsd:attribute>

complexType addDataInfo
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:info

used by

element

annotation
source

project/contentHeader/addDataInfo

documentation
List of additional data elements used in the document with description

<xsd:complexType name="addDataInfo">
<xsd:annotation>
<xsd:documentation>List of additional data elements used in the document with
description</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="info" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>

<xsd:sequence>
<xsd:element name="description" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:anyURI" use="required">
<xsd:annotation>
<xsd:documentation>Unique name of the additional data element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="version" type="xsd:decimal">
<xsd:annotation>
<xsd:documentation>Version of additional data, eg. schema version.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="vendor" type="xsd:anyURI" use="required">
<xsd:annotation>
<xsd:documentation>Vendor responsible for the definition of the additional data
element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>

element addDataInfo/info
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:description

attributes

Name
name

Type
xsd:anyURI

Use
required

Default

Fixed

annotation
documentation
Unique name
of the
additional data
element.

source

version

xsd:decimal

vendor

xsd:anyURI

required

documentation
Version of
additional
data, eg.
schema
version.
documentation
Vendor
responsible for
the definition
of the
additional data
element.

<xsd:element name="info" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:sequence>
<xsd:element name="description" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:anyURI" use="required">
<xsd:annotation>
<xsd:documentation>Unique name of the additional data element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="version" type="xsd:decimal">
<xsd:annotation>
<xsd:documentation>Version of additional data, eg. schema version.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="vendor" type="xsd:anyURI" use="required">
<xsd:annotation>
<xsd:documentation>Vendor responsible for the definition of the additional data
element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
</xsd:complexType>
</xsd:element>

attribute addDataInfo/info/@name
type
properties
annotation
source

xsd:anyURI
isRef 0
use required
documentation
Unique name of the additional data element.

<xsd:attribute name="name" type="xsd:anyURI" use="required">
<xsd:annotation>
<xsd:documentation>Unique name of the additional data element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute addDataInfo/info/@version
type

xsd:decimal

properties

isRef

0

annotation

documentation
Version of additional data, eg. schema version.

source

<xsd:attribute name="version" type="xsd:decimal">
<xsd:annotation>
<xsd:documentation>Version of additional data, eg. schema version.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute addDataInfo/info/@vendor
type
properties
annotation
source

xsd:anyURI
isRef 0
use required
documentation
Vendor responsible for the definition of the additional data element.

<xsd:attribute name="vendor" type="xsd:anyURI" use="required">
<xsd:annotation>
<xsd:documentation>Vendor responsible for the definition of the additional data
element.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

element addDataInfo/info/description
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="description" type="ppx:formattedText" minOccurs="0"/>

complexType body
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:IL ppx:ST ppx:FBD ppx:LD ppx:SFC ppx:addData ppx:documentation

used by

elements

attributes

project/types/pous/pou/actions/action/body project/types/pous/pou/transitions/transition/body
project/types/pous/pou/body sfcObjects/macroStep/body commonObjects/actionBlock/action/inline
sfcObjects/transition/condition/inline
Name
Type
Use
Default
Fixed
annotation
WorksheetName
xsd:string
optional
globalId

annotation
source

xsd:ID

optional

documentation
Implementation part of a POU, action or transistion

<xsd:complexType name="body">
<xsd:annotation>
<xsd:documentation>Implementation part of a POU, action or transistion</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:choice>
<xsd:element name="IL" type="ppx:formattedText"/>
<xsd:element name="ST" type="ppx:formattedText"/>
<xsd:element name="FBD">
<xsd:complexType>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:group ref="ppx:commonObjects"/>
<xsd:group ref="ppx:fbdObjects"/>
</xsd:choice>
</xsd:complexType>
</xsd:element>
<xsd:element name="LD">
<xsd:complexType>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:group ref="ppx:commonObjects"/>

<xsd:group ref="ppx:fbdObjects"/>
<xsd:group ref="ppx:ldObjects"/>
</xsd:choice>
</xsd:complexType>
</xsd:element>
<xsd:element name="SFC">
<xsd:complexType>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:group ref="ppx:commonObjects"/>
<xsd:group ref="ppx:fbdObjects"/>
<xsd:group ref="ppx:ldObjects"/>
<xsd:group ref="ppx:sfcObjects"/>
</xsd:choice>
</xsd:complexType>
</xsd:element>
</xsd:choice>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:sequence>
<xsd:attribute name="WorksheetName" type="xsd:string" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>

attribute body/@WorksheetName
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="WorksheetName" type="xsd:string" use="optional"/>

attribute body/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element body/IL
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText

properties
source

isRef
content

0
complex

<xsd:element name="IL" type="ppx:formattedText"/>

element body/ST
diagram

namespace
type
properties
source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
content

0
complex

<xsd:element name="ST" type="ppx:formattedText"/>

element body/FBD
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:comment ppx:error ppx:connector ppx:continuation ppx:actionBlock ppx:vendorElement ppx:block
ppx:inVariable ppx:outVariable ppx:inOutVariable ppx:label ppx:jump ppx:return

source

<xsd:element name="FBD">
<xsd:complexType>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:group ref="ppx:commonObjects"/>
<xsd:group ref="ppx:fbdObjects"/>
</xsd:choice>
</xsd:complexType>
</xsd:element>

element body/LD
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:comment ppx:error ppx:connector ppx:continuation ppx:actionBlock ppx:vendorElement ppx:block
ppx:inVariable ppx:outVariable ppx:inOutVariable ppx:label ppx:jump ppx:return ppx:leftPowerRail
ppx:rightPowerRail ppx:coil ppx:contact

source

<xsd:element name="LD">
<xsd:complexType>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:group ref="ppx:commonObjects"/>
<xsd:group ref="ppx:fbdObjects"/>

<xsd:group ref="ppx:ldObjects"/>
</xsd:choice>
</xsd:complexType>
</xsd:element>

element body/SFC
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

children

ppx:comment ppx:error ppx:connector ppx:continuation ppx:actionBlock ppx:vendorElement ppx:block
ppx:inVariable ppx:outVariable ppx:inOutVariable ppx:label ppx:jump ppx:return ppx:leftPowerRail
ppx:rightPowerRail ppx:coil ppx:contact ppx:step ppx:macroStep ppx:jumpStep ppx:transition
ppx:selectionDivergence ppx:selectionConvergence ppx:simultaneousDivergence ppx:simultaneousConvergence

source

<xsd:element name="SFC">
<xsd:complexType>
<xsd:choice minOccurs="0" maxOccurs="unbounded">
<xsd:group ref="ppx:commonObjects"/>
<xsd:group ref="ppx:fbdObjects"/>
<xsd:group ref="ppx:ldObjects"/>
<xsd:group ref="ppx:sfcObjects"/>
</xsd:choice>
</xsd:complexType>
</xsd:element>

element body/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element body/documentation
diagram

namespace
type
properties

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef 0
minOcc 0
maxOcc 1
content complex
documentation
Additional userspecific information to the element

source

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Additional userspecific information to the element</xsd:documentation>
</xsd:annotation>
</xsd:element>

complexType connection
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:position ppx:addData

used by

element

attributes

Name
globalId

Type
xsd:ID

Use
optional

refLocalId

xsd:unsignedLong

required

connectionPointIn/connection
Default

Fixed

annotation
documentation
Identifies the element
the connection starts
from.

formalParameter

annotation

source

xsd:string

optional

documentation
If present:
This attribute
denotes the name of the
VAR_OUTPUT /
VAR_IN_OUTparameter
of the pou block that is
the start of the
connection.
If not
present:
If the
refLocalId attribute
refers to a pou block,
the start of the
connection is the first
output of this block,
which is not ENO.
If the
refLocalId attribute
refers to any other
element type, the start
of the connection is the
elements single native
output.

documentation
Describes a connection between the consumer element (eg. input variable of a function block) and the producer element
(eg. output variable of a function block). It may contain a list of positions that describes the path of the connection.

<xsd:complexType name="connection">
<xsd:annotation>
<xsd:documentation>Describes a connection between the consumer element (eg. input variable
of a function block) and the producer element (eg. output variable of a function block). It may
contain a list of positions that describes the path of the connection.</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="position" type="ppx:position" minOccurs="0" maxOccurs="unbounded">
<xsd:annotation>
<xsd:documentation>All positions of the directed connection path. If any positions are given,
the list has to contain the first (input pin of the consumer element) as well as the last (output pin of
the producer element).</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
<xsd:attribute name="refLocalId" type="xsd:unsignedLong" use="required">
<xsd:annotation>
<xsd:documentation>Identifies the element the connection starts from.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="formalParameter" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>If present:
This attribute denotes the name of the VAR_OUTPUT / VAR_IN_OUTparameter of the
pou block that is the start of the connection.
If not present:
If the refLocalId attribute refers to a pou block, the start of the connection is the first output
of this block, which is not ENO.
If the refLocalId attribute refers to any other element type, the start of the connection is
the elements single native output. </xsd:documentation>
</xsd:annotation>

</xsd:attribute>
</xsd:complexType>

attribute connection/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

attribute connection/@refLocalId
type
properties
annotation
source

xsd:unsignedLong
isRef 0
use required
documentation
Identifies the element the connection starts from.

<xsd:attribute name="refLocalId" type="xsd:unsignedLong" use="required">
<xsd:annotation>
<xsd:documentation>Identifies the element the connection starts from.</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute connection/@formalParameter
type
properties
annotation

source

xsd:string
isRef 0
use optional
documentation
If present:
This attribute denotes the name of the VAR_OUTPUT / VAR_IN_OUTparameter of the pou block that is the
start of the connection.
If not present:
If the refLocalId attribute refers to a pou block, the start of the connection is the first output of this block, which
is not ENO.
If the refLocalId attribute refers to any other element type, the start of the connection is the elements single
native output.

<xsd:attribute name="formalParameter" type="xsd:string" use="optional">
<xsd:annotation>
<xsd:documentation>If present:
This attribute denotes the name of the VAR_OUTPUT / VAR_IN_OUTparameter of the
pou block that is the start of the connection.
If not present:
If the refLocalId attribute refers to a pou block, the start of the connection is the first output
of this block, which is not ENO.
If the refLocalId attribute refers to any other element type, the start of the connection is the
elements single native output. </xsd:documentation>
</xsd:annotation>
</xsd:attribute>

element connection/position
diagram

namespace
type
properties

attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
minOcc
maxOcc
content
Name
x

0
0
unbounded
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

y
annotation

source

Default

Fixed

documentation
All positions of the directed connection path. If any positions are given, the list has to contain the first (input pin of the
consumer element) as well as the last (output pin of the producer element).

<xsd:element name="position" type="ppx:position" minOccurs="0" maxOccurs="unbounded">
<xsd:annotation>
<xsd:documentation>All positions of the directed connection path. If any positions are given, the
list has to contain the first (input pin of the consumer element) as well as the last (output pin of the
producer element).</xsd:documentation>
</xsd:annotation>
</xsd:element>

element connection/addData
diagram

namespace
type

annotation

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

complexType connectionPointIn
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:relPosition ppx:connection ppx:expression ppx:addData

used by

elements

attributes

Name
globalId

annotation

documentation
Defines a connection point on the consumer side

source

sfcObjects/simultaneousConvergence/connectionPointIn
sfcObjects/simultaneousDivergence/connectionPointIn
sfcObjects/selectionConvergence/connectionPointIn
sfcObjects/selectionDivergence/connectionPointIn sfcObjects/transition/condition/connectionPointIn
sfcObjects/transition/connectionPointIn sfcObjects/jumpStep/connectionPointIn
sfcObjects/macroStep/connectionPointIn sfcObjects/step/connectionPointIn
ldObjects/contact/connectionPointIn ldObjects/coil/connectionPointIn
ldObjects/rightPowerRail/connectionPointIn fbdObjects/return/connectionPointIn
fbdObjects/jump/connectionPointIn fbdObjects/inOutVariable/connectionPointIn
fbdObjects/outVariable/connectionPointIn
fbdObjects/block/inOutVariables/variable/connectionPointIn
fbdObjects/block/inputVariables/variable/connectionPointIn
commonObjects/vendorElement/inOutVariables/variable/connectionPointIn
commonObjects/vendorElement/inputVariables/variable/connectionPointIn
commonObjects/actionBlock/connectionPointIn commonObjects/connector/connectionPointIn
Type
Use
Default
Fixed
annotation
xsd:ID
optional

<xsd:complexType name="connectionPointIn">
<xsd:annotation>
<xsd:documentation>Defines a connection point on the consumer side</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="relPosition" type="ppx:position" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Relative position of the connection pin. Origin is the anchor position of
the block.</xsd:documentation>
</xsd:annotation>
</xsd:element>

<xsd:choice minOccurs="0">
<xsd:element name="connection" type="ppx:connection" maxOccurs="unbounded"/>
<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0] or an iec expression or
multiple token text e.g. a + b (*sum*). An iec 61131-3 parser has to be used to extract variable
information.</xsd:documentation>
</xsd:annotation>
</xsd:element>
</xsd:choice>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>

attribute connectionPointIn/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element connectionPointIn/relPosition
diagram

namespace
type
properties

attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
minOcc
maxOcc
content
Name
x
y

annotation
source

0
0
1
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

annotation

documentation
Relative position of the connection pin. Origin is the anchor position of the block.

<xsd:element name="relPosition" type="ppx:position" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Relative position of the connection pin. Origin is the anchor position of the
block.</xsd:documentation>
</xsd:annotation>
</xsd:element>

element connectionPointIn/connection
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:connection
isRef
minOcc
maxOcc
content

0
1
unbounded
complex

children

ppx:position ppx:addData

attributes

Name
globalId

Type
xsd:ID

Use
optional

refLocalId

xsd:unsignedLong

required

formalParameter

xsd:string

optional

Default

Fixed

annotation
documentation
Identifies the element
the connection starts
from.
documentation
If present:

This attribute
denotes the name of the
VAR_OUTPUT /
VAR_IN_OUTparameter
of the pou block that is
the start of the
connection.
If not
present:
If the
refLocalId attribute
refers to a pou block,
the start of the
connection is the first
output of this block,
which is not ENO.
If the
refLocalId attribute
refers to any other
element type, the start
of the connection is the
elements single native
output.
source

<xsd:element name="connection" type="ppx:connection" maxOccurs="unbounded"/>

element connectionPointIn/expression
diagram

namespace
type
properties
annotation

source

http://www.plcopen.org/xml/tc6_0201
xsd:string
isRef 0
content simple
documentation
The operand is a valid iec variable e.g. avar[0] or an iec expression or multiple token text e.g. a + b (*sum*). An iec
61131-3 parser has to be used to extract variable information.

<xsd:element name="expression" type="xsd:string">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0] or an iec expression or
multiple token text e.g. a + b (*sum*). An iec 61131-3 parser has to be used to extract variable
information.</xsd:documentation>
</xsd:annotation>
</xsd:element>

element connectionPointIn/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

complexType connectionPointOut
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:relPosition ppx:expression ppx:addData

used by

elements

attributes

Name
globalId

annotation

documentation
Defines a connection point on the producer side

sfcObjects/simultaneousConvergence/connectionPointOut
sfcObjects/simultaneousDivergence/connectionPointOut
sfcObjects/selectionConvergence/connectionPointOut
sfcObjects/selectionDivergence/connectionPointOut sfcObjects/transition/connectionPointOut
sfcObjects/macroStep/connectionPointOut sfcObjects/step/connectionPointOut
ldObjects/contact/connectionPointOut ldObjects/coil/connectionPointOut
ldObjects/leftPowerRail/connectionPointOut fbdObjects/inOutVariable/connectionPointOut
fbdObjects/inVariable/connectionPointOut
fbdObjects/block/outputVariables/variable/connectionPointOut
fbdObjects/block/inOutVariables/variable/connectionPointOut
commonObjects/vendorElement/outputVariables/variable/connectionPointOut
commonObjects/vendorElement/inOutVariables/variable/connectionPointOut
commonObjects/actionBlock/action/connectionPointOut
commonObjects/continuation/connectionPointOut sfcObjects/step/connectionPointOutAction
Type
Use
Default
Fixed
annotation
xsd:ID
optional

source

<xsd:complexType name="connectionPointOut">
<xsd:annotation>
<xsd:documentation>Defines a connection point on the producer side</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="relPosition" type="ppx:position" minOccurs="0">
<xsd:annotation>
<xsd:documentation>Relative position of the connection pin. Origin is the anchor position of
the block.</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="expression" type="xsd:string" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>

attribute connectionPointOut/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element connectionPointOut/relPosition
diagram

namespace
type
properties

attributes

http://www.plcopen.org/xml/tc6_0201
ppx:position
isRef
minOcc
maxOcc
content
Name
x
y

annotation
source

0
0
1
complex
Type
xsd:decimal

Use
required

xsd:decimal

required

Default

Fixed

documentation
Relative position of the connection pin. Origin is the anchor position of the block.

<xsd:element name="relPosition" type="ppx:position" minOccurs="0">

annotation

<xsd:annotation>
<xsd:documentation>Relative position of the connection pin. Origin is the anchor position of the
block.</xsd:documentation>
</xsd:annotation>
</xsd:element>

element connectionPointOut/expression
diagram

namespace
type
properties

annotation
source

http://www.plcopen.org/xml/tc6_0201
xsd:string
isRef 0
minOcc 0
maxOcc 1
content simple
documentation
The operand is a valid iec variable e.g. avar[0].

<xsd:element name="expression" type="xsd:string" minOccurs="0">
<xsd:annotation>
<xsd:documentation>The operand is a valid iec variable e.g. avar[0].</xsd:documentation>
</xsd:annotation>
</xsd:element>

element connectionPointOut/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

complexType dataType
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

used by

elements

annotation
source

project/types/dataTypes/dataType/baseType derivedTypes/array/baseType
derivedTypes/enum/baseType derivedTypes/subrangeSigned/baseType
derivedTypes/subrangeUnsigned/baseType extended/pointer/baseType
project/types/pous/pou/interface/returnType varListPlain/variable/type
varListAccess/accessVariable/type varListConfig/configVariable/type
documentation
A generic data type

<xsd:complexType name="dataType">
<xsd:annotation>
<xsd:documentation>A generic data type</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:group ref="ppx:elementaryTypes"/>
<xsd:group ref="ppx:derivedTypes"/>
<xsd:group ref="ppx:extended"/>
</xsd:choice>
</xsd:complexType>

complexType formattedText
diagram

namespace
used by

http://www.plcopen.org/xml/tc6_0201
elements

commonObjects/vendorElement/alternativeText commonObjects/error/content
commonObjects/comment/content addDataInfo/info/description
commonObjects/vendorElement/inputVariables/variable/documentation
commonObjects/vendorElement/inOutVariables/variable/documentation
commonObjects/vendorElement/outputVariables/variable/documentation
fbdObjects/block/inputVariables/variable/documentation
fbdObjects/block/inOutVariables/variable/documentation
fbdObjects/block/outputVariables/variable/documentation fbdObjects/block/documentation
fbdObjects/inVariable/documentation fbdObjects/outVariable/documentation
fbdObjects/inOutVariable/documentation fbdObjects/label/documentation
fbdObjects/jump/documentation fbdObjects/return/documentation
ldObjects/leftPowerRail/documentation ldObjects/rightPowerRail/documentation
ldObjects/coil/documentation ldObjects/contact/documentation sfcObjects/step/documentation
sfcObjects/macroStep/documentation sfcObjects/jumpStep/documentation
sfcObjects/transition/documentation sfcObjects/selectionDivergence/documentation
sfcObjects/selectionConvergence/documentation
sfcObjects/simultaneousDivergence/documentation
sfcObjects/simultaneousConvergence/documentation
project/types/dataTypes/dataType/documentation project/types/pous/pou/interface/documentation
project/types/pous/pou/actions/action/documentation
project/types/pous/pou/transitions/transition/documentation project/types/pous/pou/documentation
project/instances/configurations/configuration/resource/task/documentation
project/instances/configurations/configuration/resource/documentation
project/instances/configurations/configuration/documentation project/documentation
body/documentation varListPlain/variable/documentation varListPlain/documentation
varListAccess/accessVariable/documentation varListAccess/documentation
varListConfig/configVariable/documentation varListConfig/documentation
pouInstance/documentation commonObjects/comment/documentation
commonObjects/error/documentation commonObjects/connector/documentation
commonObjects/continuation/documentation commonObjects/actionBlock/action/documentation

annotation
source

commonObjects/actionBlock/documentation body/IL body/ST
documentation
Formatted text according to parts of XHTML 1.1

<xsd:complexType name="formattedText">
<xsd:annotation>
<xsd:documentation>Formatted text according to parts of XHTML 1.1</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:any namespace="http://www.w3.org/1999/xhtml" processContents="lax"/>
</xsd:sequence>
</xsd:complexType>

complexType position
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

used by

elements

sfcObjects/simultaneousConvergence/position sfcObjects/simultaneousDivergence/position
sfcObjects/selectionConvergence/position sfcObjects/selectionDivergence/position
sfcObjects/transition/position sfcObjects/jumpStep/position sfcObjects/macroStep/position
sfcObjects/step/position ldObjects/contact/position ldObjects/coil/position
ldObjects/rightPowerRail/position ldObjects/leftPowerRail/position fbdObjects/return/position
fbdObjects/jump/position fbdObjects/label/position fbdObjects/inOutVariable/position
fbdObjects/outVariable/position fbdObjects/inVariable/position fbdObjects/block/position
commonObjects/vendorElement/position commonObjects/actionBlock/position
commonObjects/continuation/position commonObjects/connector/position
commonObjects/error/position commonObjects/comment/position connection/position
commonObjects/actionBlock/action/relPosition connectionPointOut/relPosition
connectionPointIn/relPosition
Type
Use
Default
Fixed
annotation
xsd:decimal
required

attributes

Name
x

annotation

documentation
Defines a graphical position in X, Y coordinates

y

source

xsd:decimal

required

<xsd:complexType name="position">
<xsd:annotation>
<xsd:documentation>Defines a graphical position in X, Y coordinates</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="x" type="xsd:decimal" use="required"/>
<xsd:attribute name="y" type="xsd:decimal" use="required"/>
</xsd:complexType>

attribute position/@x
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="x" type="xsd:decimal" use="required"/>

attribute position/@y
type
properties
source

xsd:decimal
isRef
use

0
required

<xsd:attribute name="y" type="xsd:decimal" use="required"/>

complexType pouInstance
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:addData ppx:documentation

used by

elements

attributes

Name
name

annotation
source

project/instances/configurations/configuration/resource/task/pouInstance
project/instances/configurations/configuration/resource/pouInstance
Type
Use
Default
Fixed
xsd:string
required

typeName

xsd:string

required

globalId

xsd:ID

optional

documentation
Represents a program or function block instance either running with or without a task

<xsd:complexType name="pouInstance">
<xsd:annotation>
<xsd:documentation>Represents a program or function block instance either running with or
without a task</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="typeName" type="xsd:string" use="required"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>

attribute pouInstance/@name
type
properties
source

annotation

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute pouInstance/@typeName
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="typeName" type="xsd:string" use="required"/>

attribute pouInstance/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element pouInstance/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element pouInstance/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

complexType rangeSigned
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

used by

elements

attributes

Name
lower

Type
xsd:string

Use
required

upper

xsd:string

required

annotation
source

derivedTypes/array/dimension derivedTypes/subrangeSigned/range
Default

Fixed

annotation

documentation
Defines a range with signed bounds

<xsd:complexType name="rangeSigned">
<xsd:annotation>
<xsd:documentation>Defines a range with signed bounds</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="lower" type="xsd:string" use="required"/>
<xsd:attribute name="upper" type="xsd:string" use="required"/>
</xsd:complexType>

attribute rangeSigned/@lower
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="lower" type="xsd:string" use="required"/>

attribute rangeSigned/@upper
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="upper" type="xsd:string" use="required"/>

complexType rangeUnsigned
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

used by

element

attributes

Name
lower

derivedTypes/subrangeUnsigned/range
Type
xsd:string

Use
required

Default

Fixed

annotation

upper
annotation
source

xsd:string

required

documentation
Defines a range with unsigned bounds

<xsd:complexType name="rangeUnsigned">
<xsd:annotation>
<xsd:documentation>Defines a range with unsigned bounds</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="lower" type="xsd:string" use="required"/>
<xsd:attribute name="upper" type="xsd:string" use="required"/>
</xsd:complexType>

attribute rangeUnsigned/@lower
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="lower" type="xsd:string" use="required"/>

attribute rangeUnsigned/@upper
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="upper" type="xsd:string" use="required"/>

complexType value
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:simpleValue ppx:arrayValue ppx:structValue

used by

elements

annotation
source

project/types/dataTypes/dataType/initialValue varListPlain/variable/initialValue
varListConfig/configVariable/initialValue value/arrayValue/value value/structValue/value
documentation
A generic value

<xsd:complexType name="value">
<xsd:annotation>
<xsd:documentation>A generic value</xsd:documentation>
</xsd:annotation>
<xsd:choice>
<xsd:element name="simpleValue">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Value that can be represented as a single token string
</xsd:documentation>
</xsd:annotation>

<xsd:attribute name="value" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="arrayValue">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Array value consisting of a list of occurrances - value
pairs</xsd:documentation>
</xsd:annotation>
<xsd:sequence minOccurs="0" maxOccurs="unbounded">
<xsd:element name="value">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:value">
<xsd:attribute name="repetitionValue" type="xsd:string" use="optional" default="1"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
<xsd:element name="structValue">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Struct value consisting of a list of member - value
pairs</xsd:documentation>
</xsd:annotation>
<xsd:sequence minOccurs="0" maxOccurs="unbounded">
<xsd:element name="value">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:value">
<xsd:attribute name="member" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>
</xsd:choice>
</xsd:complexType>

element value/simpleValue
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
content

0
complex

attributes
source

Name
value

Type
xsd:string

Use
optional

Default

Fixed

annotation

<xsd:element name="simpleValue">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Value that can be represented as a single token string
</xsd:documentation>
</xsd:annotation>
<xsd:attribute name="value" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute value/simpleValue/@value
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="value" type="xsd:string" use="optional"/>

element value/arrayValue
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

0
complex

children

ppx:value

source

<xsd:element name="arrayValue">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Array value consisting of a list of occurrances - value
pairs</xsd:documentation>
</xsd:annotation>
<xsd:sequence minOccurs="0" maxOccurs="unbounded">
<xsd:element name="value">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:value">
<xsd:attribute name="repetitionValue" type="xsd:string" use="optional" default="1"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element value/arrayValue/value
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:value
isRef
content

0
complex

children

ppx:simpleValue ppx:arrayValue ppx:structValue

attributes

Name
repetitionValue

source

Type
xsd:string

Use
optional

Default
1

Fixed

<xsd:element name="value">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:value">
<xsd:attribute name="repetitionValue" type="xsd:string" use="optional" default="1"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>

attribute value/arrayValue/value/@repetitionValue
type
properties

source

xsd:string
isRef
default
use

0
1
optional

<xsd:attribute name="repetitionValue" type="xsd:string" use="optional" default="1"/>

element value/structValue
diagram

namespace

annotation

http://www.plcopen.org/xml/tc6_0201

properties

isRef
content

children

ppx:value

0
complex

source

<xsd:element name="structValue">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Struct value consisting of a list of member - value
pairs</xsd:documentation>
</xsd:annotation>
<xsd:sequence minOccurs="0" maxOccurs="unbounded">
<xsd:element name="value">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:value">
<xsd:attribute name="member" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>
</xsd:element>
</xsd:sequence>
</xsd:complexType>
</xsd:element>

element value/structValue/value
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:value
isRef
content

0
complex

children

ppx:simpleValue ppx:arrayValue ppx:structValue

attributes

Name
member

source

Type
xsd:string

Use
required

Default

Fixed

<xsd:element name="value">
<xsd:complexType>
<xsd:complexContent>
<xsd:extension base="ppx:value">
<xsd:attribute name="member" type="xsd:string" use="required"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>

annotation

</xsd:element>

attribute value/structValue/value/@member
type
properties
source

xsd:string
isRef
use

0
required

<xsd:attribute name="member" type="xsd:string" use="required"/>

complexType varList
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
extension of ppx:varListPlain
base

ppx:varListPlain

children

ppx:variable ppx:addData ppx:documentation

used by

elements

attributes

Name
name

project/types/pous/pou/interface/accessVars project/types/pous/pou/interface/externalVars
project/types/pous/pou/interface/globalVars
project/instances/configurations/configuration/resource/globalVars
project/instances/configurations/configuration/globalVars
project/types/pous/pou/interface/inOutVars project/types/pous/pou/interface/inputVars
project/types/pous/pou/interface/localVars project/types/pous/pou/interface/outputVars
project/types/pous/pou/interface/tempVars
Type
Use
Default
Fixed
annotation
xsd:string
optional

constant

xsd:boolean

optional

false

retain

xsd:boolean

optional

false

annotation

source

nonretain

xsd:boolean

optional

false

persistent

xsd:boolean

optional

false

nonpersistent

xsd:boolean

optional

false

documentation
List of variable declarations that share the same memory attributes (CONSTANT, RETAIN, NON_RETAIN,
PERSISTENT)

<xsd:complexType name="varList">
<xsd:annotation>
<xsd:documentation>List of variable declarations that share the same memory attributes
(CONSTANT, RETAIN, NON_RETAIN, PERSISTENT)</xsd:documentation>
</xsd:annotation>
<xsd:complexContent>
<xsd:extension base="ppx:varListPlain">
<xsd:attribute name="name" type="xsd:string" use="optional"/>
<xsd:attribute name="constant" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="retain" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="nonretain" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="persistent" type="xsd:boolean" use="optional" default="false"/>
<xsd:attribute name="nonpersistent" type="xsd:boolean" use="optional" default="false"/>
</xsd:extension>
</xsd:complexContent>
</xsd:complexType>

attribute varList/@name
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="name" type="xsd:string" use="optional"/>

attribute varList/@constant
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="constant" type="xsd:boolean" use="optional" default="false"/>

attribute varList/@retain
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="retain" type="xsd:boolean" use="optional" default="false"/>

attribute varList/@nonretain
type
properties

xsd:boolean
isRef
default

0
false

use
source

optional

<xsd:attribute name="nonretain" type="xsd:boolean" use="optional" default="false"/>

attribute varList/@persistent
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="persistent" type="xsd:boolean" use="optional" default="false"/>

attribute varList/@nonpersistent
type
properties

source

xsd:boolean
isRef
default
use

0
false
optional

<xsd:attribute name="nonpersistent" type="xsd:boolean" use="optional" default="false"/>

complexType varListAccess
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:accessVariable ppx:addData ppx:documentation

used by

element

annotation
source

project/instances/configurations/configuration/accessVars

documentation
List of access variable declarations

<xsd:complexType name="varListAccess">
<xsd:annotation>
<xsd:documentation>List of access variable declarations</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="accessVariable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Declaration of an access variable</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="type" type="ppx:dataType"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="alias" type="xsd:string" use="required">
<xsd:annotation>

<xsd:documentation>Name that is visible to the communication
partner</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="instancePathAndName" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Variable name including instance path inside the
configuration</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="direction" type="ppx:accessType" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
</xsd:complexType>

element varListAccess/accessVariable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:type ppx:addData ppx:documentation

attributes

Name
alias

Type
xsd:string

Use
required

instancePathAndName

xsd:string

required

Default

Fixed

annotation
documentation
Name that is
visible to the
communication
partner
documentation
Variable name
including
instance path
inside the
configuration

direction
source

ppx:accessType

optional

<xsd:element name="accessVariable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Declaration of an access variable</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="type" type="ppx:dataType"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="alias" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Name that is visible to the communication partner</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="instancePathAndName" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Variable name including instance path inside the
configuration</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="direction" type="ppx:accessType" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute varListAccess/accessVariable/@alias
type
properties
annotation
source

xsd:string
isRef 0
use required
documentation
Name that is visible to the communication partner

<xsd:attribute name="alias" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Name that is visible to the communication partner</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute varListAccess/accessVariable/@instancePathAndName
type
properties
annotation
source

xsd:string
isRef 0
use required
documentation
Variable name including instance path inside the configuration

<xsd:attribute name="instancePathAndName" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Variable name including instance path inside the
configuration</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute varListAccess/accessVariable/@direction
type
properties
facets
source

ppx:accessType
isRef 0
use optional
enumeration readOnly
enumeration readWrite

<xsd:attribute name="direction" type="ppx:accessType" use="optional"/>

element varListAccess/accessVariable/type
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="type" type="ppx:dataType"/>

element varListAccess/accessVariable/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element varListAccess/accessVariable/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element varListAccess/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element varListAccess/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

complexType varListConfig
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:configVariable ppx:addData ppx:documentation

used by

element

annotation
source

project/instances/configurations/configuration/configVars

documentation
List of VAR_CONFIG variables

<xsd:complexType name="varListConfig">
<xsd:annotation>
<xsd:documentation>List of VAR_CONFIG variables</xsd:documentation>

</xsd:annotation>
<xsd:sequence>
<xsd:element name="configVariable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Declaration of an access variable</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="type" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="instancePathAndName" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Variable name including instance path</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="address" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
</xsd:complexType>

element varListConfig/configVariable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:type ppx:initialValue ppx:addData ppx:documentation

attributes

Name
instancePathAndName

Type
xsd:string

Use
required

Default

Fixed

annotation
documentation
Variable name
including

instance path
address
source

xsd:string

optional

<xsd:element name="configVariable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Declaration of an access variable</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="type" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="instancePathAndName" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Variable name including instance path</xsd:documentation>
</xsd:annotation>
</xsd:attribute>
<xsd:attribute name="address" type="xsd:string" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute varListConfig/configVariable/@instancePathAndName
type
properties
annotation
source

xsd:string
isRef 0
use required
documentation
Variable name including instance path

<xsd:attribute name="instancePathAndName" type="xsd:string" use="required">
<xsd:annotation>
<xsd:documentation>Variable name including instance path</xsd:documentation>
</xsd:annotation>
</xsd:attribute>

attribute varListConfig/configVariable/@address
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="address" type="xsd:string" use="optional"/>

element varListConfig/configVariable/type
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="type" type="ppx:dataType"/>

element varListConfig/configVariable/initialValue
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:value

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:simpleValue ppx:arrayValue ppx:structValue

source

<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>

element varListConfig/configVariable/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element varListConfig/configVariable/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element varListConfig/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element varListConfig/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

complexType varListPlain
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

children

ppx:variable ppx:addData ppx:documentation

used by

element derivedTypes/struct
complexType varList
documentation
List of variable declarations without attributes

annotation
source

<xsd:complexType name="varListPlain">
<xsd:annotation>
<xsd:documentation>List of variable declarations without attributes</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Declaration of a variable</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="type" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="address" type="xsd:string" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
</xsd:complexType>

element varListPlain/variable
diagram

namespace
properties

http://www.plcopen.org/xml/tc6_0201
isRef
minOcc
maxOcc
content

0
0
unbounded
complex

children

ppx:type ppx:initialValue ppx:addData ppx:documentation

attributes

Name
name

Type
xsd:string

Use
required

address

xsd:string

optional

globalId

xsd:ID

optional

source

Default

properties
source

annotation

<xsd:element name="variable" minOccurs="0" maxOccurs="unbounded">
<xsd:complexType>
<xsd:annotation>
<xsd:documentation>Declaration of a variable</xsd:documentation>
</xsd:annotation>
<xsd:sequence>
<xsd:element name="type" type="ppx:dataType"/>
<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>
<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>
<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>
</xsd:sequence>
<xsd:attribute name="name" type="xsd:string" use="required"/>
<xsd:attribute name="address" type="xsd:string" use="optional"/>
<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>
</xsd:complexType>
</xsd:element>

attribute varListPlain/variable/@name
type

Fixed

xsd:string
isRef
use

0
required

<xsd:attribute name="name" type="xsd:string" use="required"/>

attribute varListPlain/variable/@address
type
properties
source

xsd:string
isRef
use

0
optional

<xsd:attribute name="address" type="xsd:string" use="optional"/>

attribute varListPlain/variable/@globalId
type

xsd:ID

properties

isRef
use

source

0
optional

<xsd:attribute name="globalId" type="xsd:ID" use="optional"/>

element varListPlain/variable/type
diagram

namespace
type
properties

http://www.plcopen.org/xml/tc6_0201
ppx:dataType
isRef
content

0
complex

children

ppx:BOOL ppx:BYTE ppx:WORD ppx:DWORD ppx:LWORD ppx:SINT ppx:INT ppx:DINT ppx:LINT ppx:USINT
ppx:UINT ppx:UDINT ppx:ULINT ppx:REAL ppx:LREAL ppx:TIME ppx:DATE ppx:DT ppx:TOD ppx:string
ppx:wstring ppx:ANY ppx:ANY_DERIVED ppx:ANY_ELEMENTARY ppx:ANY_MAGNITUDE ppx:ANY_NUM
ppx:ANY_REAL ppx:ANY_INT ppx:ANY_BIT ppx:ANY_STRING ppx:ANY_DATE ppx:array ppx:derived ppx:enum
ppx:struct ppx:subrangeSigned ppx:subrangeUnsigned ppx:pointer

source

<xsd:element name="type" type="ppx:dataType"/>

element varListPlain/variable/initialValue
diagram

namespace

http://www.plcopen.org/xml/tc6_0201

type

ppx:value

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:simpleValue ppx:arrayValue ppx:structValue

source

<xsd:element name="initialValue" type="ppx:value" minOccurs="0"/>

element varListPlain/variable/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element varListPlain/variable/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

element varListPlain/addData
diagram

namespace
type

http://www.plcopen.org/xml/tc6_0201
ppx:addData

properties

isRef
minOcc
maxOcc
content

0
0
1
complex

children

ppx:data

source

<xsd:element name="addData" type="ppx:addData" minOccurs="0"/>

element varListPlain/documentation
diagram

namespace
type
properties

source

http://www.plcopen.org/xml/tc6_0201
ppx:formattedText
isRef
minOcc
maxOcc
content

0
0
1
complex

<xsd:element name="documentation" type="ppx:formattedText" minOccurs="0"/>

simpleType accessType
namespace
type
used by
facets
annotation
source

http://www.plcopen.org/xml/tc6_0201
restriction of xsd:NMTOKEN
attribute

varListAccess/accessVariable/@direction

enumeration readOnly
enumeration readWrite
documentation
Defines the different access types to an accessVariable

<xsd:simpleType name="accessType">
<xsd:annotation>
<xsd:documentation>Defines the different access types to an
accessVariable</xsd:documentation>
</xsd:annotation>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="readOnly"/>
<xsd:enumeration value="readWrite"/>
</xsd:restriction>
</xsd:simpleType>

simpleType edgeModifierType
namespace
type
used by

facets

annotation
source

http://www.plcopen.org/xml/tc6_0201
restriction of xsd:string
attributes

commonObjects/vendorElement/inputVariables/variable/@edge
commonObjects/vendorElement/inOutVariables/variable/@edge
commonObjects/vendorElement/outputVariables/variable/@edge
fbdObjects/block/inputVariables/variable/@edge fbdObjects/block/inOutVariables/variable/@edge
fbdObjects/block/outputVariables/variable/@edge fbdObjects/inVariable/@edge
fbdObjects/outVariable/@edge ldObjects/coil/@edge ldObjects/contact/@edge
fbdObjects/inOutVariable/@edgeIn fbdObjects/inOutVariable/@edgeOut
enumeration none
enumeration falling
enumeration rising
documentation
Defines the edge detection behaviour of a variable

<xsd:simpleType name="edgeModifierType">
<xsd:annotation>
<xsd:documentation>Defines the edge detection behaviour of a variable</xsd:documentation>
</xsd:annotation>
<xsd:restriction base="xsd:string">
<xsd:enumeration value="none"/>
<xsd:enumeration value="falling"/>
<xsd:enumeration value="rising"/>
</xsd:restriction>
</xsd:simpleType>

simpleType pouType
namespace
type
used by
facets

http://www.plcopen.org/xml/tc6_0201
restriction of xsd:NMTOKEN
attribute

project/types/pous/pou/@pouType

enumeration
enumeration

function
functionBlock

annotation
source

enumeration program
documentation
Defines the different types of a POU

<xsd:simpleType name="pouType">
<xsd:annotation>
<xsd:documentation>Defines the different types of a POU</xsd:documentation>
</xsd:annotation>
<xsd:restriction base="xsd:NMTOKEN">
<xsd:enumeration value="function"/>
<xsd:enumeration value="functionBlock"/>
<xsd:enumeration value="program"/>
</xsd:restriction>
</xsd:simpleType>

simpleType storageModifierType
namespace
type
used by

facets

annotation
source

http://www.plcopen.org/xml/tc6_0201
restriction of xsd:string
attributes

commonObjects/vendorElement/inputVariables/variable/@storage
commonObjects/vendorElement/inOutVariables/variable/@storage
commonObjects/vendorElement/outputVariables/variable/@storage
fbdObjects/block/inputVariables/variable/@storage
fbdObjects/block/inOutVariables/variable/@storage
fbdObjects/block/outputVariables/variable/@storage fbdObjects/inVariable/@storage
fbdObjects/outVariable/@storage ldObjects/coil/@storage ldObjects/contact/@storage
fbdObjects/inOutVariable/@storageIn fbdObjects/inOutVariable/@storageOut
enumeration none
enumeration set
enumeration reset
documentation
Defines the storage mode (S/R) behaviour of a variable

<xsd:simpleType name="storageModifierType">
<xsd:annotation>
<xsd:documentation>Defines the storage mode (S/R) behaviour of a
variable</xsd:documentation>
</xsd:annotation>
<xsd:restriction base="xsd:string">
<xsd:enumeration value="none"/>
<xsd:enumeration value="set"/>
<xsd:enumeration value="reset"/>
</xsd:restriction>
</xsd:simpleType>

XML Schema documentation generated by XMLSpy Schema Editor http://www.altova.com/xmlspy

