import { IFieldMeta as FieldMeta, IWidgetField, IWidgetTable, TableMeta, bitable } from "@base-open/web-api";
import { useEffect, useState, useRef } from "react";
import { Form, Toast, Spin, Tooltip, Button, Col, Row } from "@douyinfe/semi-ui";
import { IconHelpCircle, IconClose } from '@douyinfe/semi-icons';
import DelTable from "./table";








/** 如f-12345678 */
function getLast8Digits() {
  let timestamp = new Date().getTime();
  // 获取时间戳的字符串形式
  const timestampString = timestamp.toString();
  // 获取时间戳字符串的最后6位，如果不足6位则返回整个字符串
  const last8Digits = timestampString.slice(-8);
  return 'f-' + last8Digits;
}

/** 找出来需要被删除的那些，key为字段值的json格式 */
export interface ToDelete {
  /** 找出来需要被删除的那些，key为字段值的json格式  */
  [p: string]: string[]
}
/** 找出来需要被保留的那个，key为字段值的json格式 */
export interface Existing {
  /** 找出来需要被保留的那个,key为字段值的json格式  */
  [p: string]: string
}

/** 当前table级的信息 */
export interface TableInfo {
  /** 当前所选的table,默认为打开插件时的table */
  table: IWidgetTable,
  /** 当前所选table的元信息 */
  tableMeta: TableMeta
  /** 所有的table元信息 */
  tableMetaList: TableMeta[],
  /** 所有table的实例 */
  tableList: IWidgetTable[]
}

/** 当前table所有field信息 */
export interface FieldInfo {
  /**当前所选field的实例 */
  field: IWidgetField | undefined
  /** 当前所选field的元信息 */
  fieldMeta: FieldMeta | undefined
  /** tableInfo.table的所有field实例 */
  fieldList: IWidgetField[],
  /** tableInfo.table的所有field元信息 */
  fieldMetaList: FieldMeta[]
}

/** 表单所选的字段相关信息 */
export interface FormFields {
  /** 用来排序的那个field的相关信息 */
  sortFieldValueList: {
    field: IWidgetField,
    fieldMeta: FieldMeta,
    valueList: any[]
  },
  /** 标识字段值那些列的相关信息 */
  identifyingFieldsValueList: {
    field: IWidgetField,
    fieldMeta: FieldMeta,
    valueList: any[]
  }[]
}

export default function T() {
  const [loading, setLoading] = useState(false);
  const [toDelete, setToDelete] = useState<ToDelete>()
  const [existing, setExisting] = useState<Existing>()

  // 传给table的props，
  const [fieldsValueLists, setFieldsValueLists] = useState<FormFields>()
  const [, f] = useState<any>()

  const updateCom = () => f({})
  //用来数filed的，控制新增/删除标识字段
  const count = useRef<Set<string>>(new Set([getLast8Digits()]))

  /** toDelete中的所有recordId */
  const toDeleteRecordIds = useRef<string[]>([])

  const [tableInfo, setTableInfo] = useState<TableInfo>();
  const [fieldInfo, setFieldInfo] = useState<FieldInfo>()

  const formApi = useRef<any>()

  useEffect(() => {
    async function init() {
      const selection = await bitable.base.getSelection();
      if (selection.tableId) {
        const [tableRes, tableMetaListRes, tableListRes] = await Promise.all([
          bitable.base.getTableById(selection.tableId),
          bitable.base.getTableMetaList(),
          bitable.base.getTableList()
        ]);
        setTableInfo({
          table: tableRes,
          tableMeta: tableMetaListRes.find(({ id }) => tableRes.id === id)!,
          tableMetaList: tableMetaListRes,
          tableList: tableListRes
        });
        // 清空其他选项
        formApi.current.setValues({ 'table': tableRes.id })

        const fieldMetaList = await tableRes.getFieldMetaList();
        const fieldList = await tableRes.getFieldList();
        setFieldInfo({
          fieldList,
          fieldMetaList,
          field: undefined,
          fieldMeta: undefined
        })
      }
    }
    init();
  }, [])

  const del = async () => {
    const { field3, ...restFields } = formApi.current.getValues();
    let keys = Object.keys(restFields);

    if (!(keys.length && field3)) {
      Toast.error('请选择完整字段')
      return;
    }
    setLoading(true);
    setTimeout(async () => {
      let { table, field3, ...restFields } = formApi.current.getValues();
      restFields = JSON.parse(JSON.stringify(restFields))
      let keys = Object.keys(restFields);
      let existing = Object.create(null);
      let toDelete: ToDelete = {};
      toDeleteRecordIds.current = [];



      /** 所有标识字段实例 */
      const findFields = keys.map((f) => fieldInfo?.fieldList.find(({ id }) => id === restFields[f])).filter((v) => v)




      /** field3 用来比较的字段 */
      const sortField = fieldInfo?.fieldList.find(({ id }) => id === field3)!
      //sortFieldValueList:field3，用来比较的字段的值列表, identifyingFieldsValueList：其余标识字段值列表数组
      const [sortFieldValueList, ...identifyingFieldsValueList] = await Promise.all([
        sortField.getFieldValueList(),
        ...findFields.map((f) => f?.getFieldValueList()!)
      ])
      setFieldsValueLists({
        sortFieldValueList: {
          field: sortField,
          fieldMeta: fieldInfo?.fieldMetaList.find(({ id }) => sortField.id === id)!,
          valueList: sortFieldValueList
        },
        identifyingFieldsValueList: (findFields.map((f, index) => {
          return {
            field: f!,
            valueList: identifyingFieldsValueList[index],
            fieldMeta: fieldInfo?.fieldMetaList.find(({ id }) => f?.id === id)!
          }
        }))
      })


      function choose(recordA: string, recordB: string) {
        let findA = sortFieldValueList.find(({ record_id }) => record_id === recordA)?.value || 0;
        let findB = sortFieldValueList.find(({ record_id }) => record_id === recordB)?.value || 0;
        if (Array.isArray(findA)) {
          // @ts-ignore
          findA = findA.map((({ text, id, name }) => text || name || id)).join('')
        }
        if (Array.isArray(findB)) {
          // @ts-ignore
          findB = findB.map((({ text, id, name }) => text || name || id)).join('')
        }
        let valueA = findA;
        let valueB = findB;
        return valueA > valueB ? { keep: recordA, discard: recordB } : { keep: recordB, discard: recordA };
      }


      let minLengthFieldValueList = identifyingFieldsValueList[0] || []
      identifyingFieldsValueList.forEach((v) => {
        if (v?.length < minLengthFieldValueList?.length) {
          minLengthFieldValueList = v
        }
      })
      for (let re of minLengthFieldValueList) {
        let record = re.record_id
        if (record) {
          /** record这一行，字段1和字段2的值 */
          let key = JSON.stringify([
            ...identifyingFieldsValueList.map((f) => f.find(({ record_id }) => record_id === record)?.value)
          ]);
          if (key in existing) {
            let { keep, discard } = choose(record, existing[key]);
            toDeleteRecordIds.current.push(discard)
            if (toDelete[key]) {
              toDelete[key].push(discard)
            } else {
              toDelete[key] = [discard]
            }
            existing[key] = keep;
          } else {
            existing[key] = record;
          }
        }
      }

      console.log('toDelete:', { existing, toDelete });
      setToDelete(toDelete);
      setExisting(existing)
      setLoading(false)

    }, 0);
  }


  /** 选择table的时候更新tableInfo和fieldInfo */
  const onSelectTable = async (t: any) => {
    if (tableInfo) {
      // 单选
      setLoading(true)
      const { tableList, tableMetaList } = tableInfo
      const choosedTable = tableList.find(({ id }) => id === t)!;
      const choosedTableMeta = tableMetaList.find(({ id }) => id === t)!;
      setTableInfo({
        ...tableInfo,
        table: choosedTable,
        tableMeta: choosedTableMeta
      });
      const [fieldMetaList, fieldList] = await Promise.all([choosedTable.getFieldMetaList(), choosedTable.getFieldList()])
      console.log('fieldList', await fieldList[0]?.getFieldValueList());
      setFieldInfo({
        fieldList,
        fieldMetaList,
        field: undefined,
        fieldMeta: undefined
      });
      setLoading(false)
      formApi.current.setValues({
        table: choosedTable.id
      })
    }
  }

  const onSelectField = (f: any) => {
    if (!tableInfo?.table) {
      Toast.error('请先选择table');
      return;
    } else {
      const { fieldMetaList, fieldList } = fieldInfo!
      const choosedField = fieldList.find(({ id }) => f === id)!
      const choosedFieldMeta = fieldMetaList.find(({ id }) => f === id)!;
      setFieldInfo({
        ...fieldInfo,
        field: choosedField,
        fieldMeta: choosedFieldMeta
      } as any)
    }
  }


  console.log(tableInfo, fieldInfo);

  const onDel = async (del: any) => {
    setLoading(true);
    await del();
    setLoading(false);
    setToDelete({});
    setExisting({});
  }

  const fieldMetas = (Array.isArray(fieldInfo?.fieldMetaList) &&
    // 等待切换table的时候，拿到正确的fieldList
    fieldInfo?.fieldList[0]?.tableId === tableInfo?.table.id &&
    fieldInfo?.fieldMetaList) || []

  return <div>
    <Spin size="large" spinning={loading}>
      <div>
        <p>
          将根据标识字段的值删除给定表中的重复记录。当每个标识字段包含相同的单元格值时，将认为它们是重复的记录。
          对于被认为是重复的任何两条记录，将使用第三个比较字段来确定应该删除这两条记录中的哪一条。
        </p>
        <br />
      </div>
      <Form
        labelPosition='left'
        labelAlign='right'
        getFormApi={(e: any) => formApi.current = e}>
        <Form.Select style={{ width: '100%' }} onChange={onSelectTable} label='Table' field="table">
          {
            Array.isArray(tableInfo?.tableMetaList) && tableInfo?.tableMetaList.map(({ id, name }) => <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>)
          }
        </Form.Select>
        <Form.Select style={{ width: '100%' }} onChange={onSelectField} label='原始内容字段' field="field">
          {
            fieldMetas.map(({ id, name }) => <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>)
          }
        </Form.Select>
        任意2行的以下字段相同的时候认为他们是重复的行
        {[...count.current].map((v, index) => {
          let after = <div style={{
            display: 'inline-block',
            padding: '14px',
            cursor: 'pointer'
          }} onClick={() => { count.current.delete(v); updateCom(); }}><IconClose /> </div>

          return <Row key={v}>
            <Col span={20}><Form.Select style={{ width: '100%' }} onChange={onSelectField} label={`标识字段${index + 2}`} field={v}>
              {
                fieldMetas.map(({ id, name }) => <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>)
              }
            </Form.Select></Col>
            <Col span={4}>
              {after}
            </Col>
          </Row>
        })}


        {fieldInfo?.fieldMetaList && <Button disabled={!(count.current.size <= fieldInfo?.fieldMetaList.length - 1)} onClick={() => {
          count.current.add(getLast8Digits());
          updateCom();
        }}>新增标识字段</Button>}
        <Form.Select style={{ width: '100%' }} onChange={onSelectField} label={{
          text: '比较字段',
          extra: <Tooltip content='重复的记录中,本字段值较大的那一行记录将被保留，较小的那一行记录将被删除'><IconHelpCircle style={{ color: 'var(--semi-color-text-2)' }} /></Tooltip>
        }} field="field3">
          {
            fieldMetas.map(({ id, name }) => <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>)
          }x
        </Form.Select>
      </Form>

      <Row>
        <Col span={6}></Col>
        <Col span={18}>
          <Button onClick={del}> 查找重复项 </Button>
        </Col>
      </Row>
      {existing && toDelete && fieldInfo?.fieldMetaList && fieldsValueLists && tableInfo && toDeleteRecordIds.current.length > 0 && <DelTable
        getOnDel={onDel}
        key={toDeleteRecordIds.current.join('')}
        defaultToDelRecords={toDeleteRecordIds.current}
        existing={existing}
        toDelete={toDelete}
        tableFieldMetaList={fieldInfo?.fieldMetaList}
        formFields={fieldsValueLists}
        fieldInfo={fieldInfo}
        tableInfo={tableInfo}
      ></DelTable>}
    </Spin>
  </div>
}
